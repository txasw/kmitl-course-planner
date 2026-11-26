// The fill engine (ADR-0078): for each subject the student's press named, one at a time,
// it reads the page, asks the pure decisions what to do, acts once through the
// actuator, waits for the host's answer, and verifies it from a fresh reading before the
// next step. A wait ends as soon as the page changes into the answer it waits for, so a
// run moves at the host's pace, not a clock's (the timing amendment of 2026-11-26). A
// wait that reaches its ceiling is a stop, never a retry, and the first stop
// ends the run (owner answer 3A). It sends no request of its own: the only request in a
// run is the host's own eligibility read after the field is filled, which the tripwire
// counts. The host's period check, which app.a1e43722 runs every 60 s and on a focus, is
// left out of the count (owner ruling of 2026-11-26), and any other request stops the run
// as a request of the page's own, unless it ended before KCP first acted, which the run
// waits out at its start when the page made a request just before. The subject stays to
// add, and the student's next press picks it up where the page left it. What it reads
// stays in memory.

import type { Plan } from '@/lib/domain/plan';
import type { HostObservation } from '@/lib/regis/hostObservation';
import type { RegistrationKit } from '@/lib/regis/kitSchema';
import {
  listClash,
  listedState,
  overCredits,
  overSubscribed,
  pageBlock,
  pickOption,
  practiceHolds,
  type FillHalf,
  type FillTarget,
  type StopReason,
} from '@/lib/regis/fillPlan';
import { panelOf, readHostPage } from '../host/hostDom';
import {
  chooseOption,
  enterSubjectId,
  openMenu,
  pressAcknowledge,
  pressAdd,
  type Actuation,
} from './hostActuator';
import {
  resolveAcknowledge,
  resolveActivator,
  resolveAdd,
  resolveField,
  resolveOptions,
} from './hostControls';
import { watchPage, type PageWatch } from './pageWatch';
import type { Tripwire } from './tripwire';

export type FillStep =
  'enter' | 'wait' | 'conditional' | 'choose' | 'practice' | 'add';

export type FillOutcome =
  | { status: 'done'; filled: number }
  | { status: 'stopped'; subjectId: string | null; reason: StopReason };

export interface FillTiming {
  /**
   * The longest a wait goes without reading the page when the page does not change, so
   * a Stop press and a ceiling are read within this time.
   */
  poll: number;
  /** How long the host may take to answer the eligibility read. */
  answer: number;
  /** How long any other host change may take. */
  settle: number;
  /**
   * How long KCP's own UI must have shown the condition before KCP acknowledges the
   * dialog (owner answer 5B), waited for at most `settle`.
   */
  acknowledge: number;
  /**
   * How long the request count must stay the same before KCP first acts in a run,
   * waited for at most `settle`, and only when the page made a request this recently.
   */
  quiet: number;
}

// There is no pace between events. The host's handlers take each event in its own task:
// the field's v-model and its search run on the one input event, a select opens its menu
// on the activator's click and takes an option on the option's click, and Add pushes to
// the list on its click, each rendered by Vue in a microtask. The run verifies every
// answer from a fresh reading before it acts again, so a delay would only make the
// student wait. Each action still begins on a task of its own, so a Stop press in
// between is read first.
export const FILL_TIMING: FillTiming = {
  poll: 100,
  answer: 60_000,
  settle: 3000,
  acknowledge: 750,
  quiet: 1500,
};

export interface FillDeps {
  doc: Document;
  plan: Plan;
  kit: RegistrationKit;
  targets: readonly FillTarget[];
  /** Subjects the student chose to fill although over subscribed (owner answer 4A). */
  allowFull: ReadonlySet<string>;
  /** The student pressed Stop, the route changed, or a surrogate session began. */
  stopRequested: () => boolean;
  onStep: (
    subjectId: string,
    step: FillStep,
    prerequisites: readonly string[],
  ) => void;
  /** Latch fill off for this host build after an actuator refusal. */
  onRefusal: () => void;
  /**
   * When KCP's own UI began showing this subject's condition, in the clock of `now`, or
   * null while it does not show it (owner answer 5B).
   */
  conditionShownSince: (subjectId: string) => number | null;
  tripwire: Tripwire;
  timing?: FillTiming;
  now?: () => number;
  /** How the run waits for the page to change; the tests wrap the real one. */
  watchPage?: (doc: Document) => PageWatch;
}

class Stop extends Error {
  constructor(readonly reason: StopReason) {
    super(reason);
  }
}

function stop(reason: StopReason): never {
  throw new Stop(reason);
}

export async function runFill(deps: FillDeps): Promise<FillOutcome> {
  const { doc, plan, kit, tripwire } = deps;
  const timing = deps.timing ?? FILL_TIMING;
  const now = deps.now ?? (() => Date.now());
  const planned = new Set(deps.targets.map((target) => target.subjectId));
  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  const watch = (deps.watchPage ?? watchPage)(doc);

  // Whether the run has acted on the page yet, so a page with no panel is a page that
  // changed under the run rather than one that was never ready.
  let acted = false;
  // The request count each step is measured from. It starts over only until KCP first
  // acts; from then on it carries from one subject to the next, so no request after an
  // action of KCP's is ever left out.
  let requests = 0;
  let quieted = false;

  // A page with no panel, or with another panel than the run began on, ends the run at
  // once: the host can unmount the panel on its own, as the period check of app.a1e43722
  // does when it rewrites the period, and mount a new one from its own empty data, which
  // has lost the subjects already added. Nothing on such a page may be acted on or waited
  // for, and this holds without the tripwire, which some browsers lack.
  const startPanel = panelOf(doc);
  function read(): HostObservation | null {
    const reading = readHostPage(doc, planned);
    if (reading.reading === 'absent' || panelOf(doc) !== startPanel) {
      stop(acted ? 'pageChanged' : 'notReady');
    }
    return reading.reading === 'ok' ? reading.observation : null;
  }

  function page(): HostObservation {
    const observation = read();
    const block = pageBlock(observation, plan);
    if (observation === null || block !== null) stop(block ?? 'notRecognised');
    return observation;
  }

  async function waitFor<T>(
    test: (observation: HostObservation) => T | null,
    ceiling: number,
    onTimeout: StopReason,
  ): Promise<T> {
    const until = now() + ceiling;
    for (;;) {
      if (deps.stopRequested()) stop('stopped');
      const observation = read();
      const value = observation === null ? null : test(observation);
      if (value !== null) return value;
      if (now() > until) stop(onTimeout);
      await watch.change(timing.poll);
    }
  }

  // Resolves the control and acts in one task of its own, after a Stop check.
  async function act(perform: () => Actuation | null): Promise<void> {
    if (deps.stopRequested()) stop('stopped');
    await watch.task();
    if (deps.stopRequested()) stop('stopped');
    read();
    acted = true;
    const outcome = perform();
    if (outcome === 'refused') {
      deps.onRefusal();
      stop('notRecognised');
    }
    if (outcome !== 'done')
      stop(outcome === null ? 'notRecognised' : 'pageChanged');
  }

  function selected(
    observation: HostObservation,
    which: 'primary' | 'practice',
  ) {
    return (
      (which === 'primary'
        ? observation.card?.primary
        : observation.card?.practice) ?? null
    );
  }

  async function chooseHalf(
    target: FillTarget,
    which: 'primary' | 'practice',
    half: FillHalf,
  ): Promise<void> {
    deps.onStep(
      target.subjectId,
      which === 'primary' ? 'choose' : 'practice',
      [],
    );
    const shown = selected(page(), which);
    if (shown !== null) {
      if (shown.section !== half.code) stop('pageChanged');
      return;
    }
    await act(() => {
      const activator = resolveActivator(doc, which);
      return activator === null ? null : openMenu(activator);
    });
    const options = await waitFor(
      () => resolveOptions(doc, which),
      timing.settle,
      'notRecognised',
    );
    const index = pickOption(options, half);
    if (typeof index === 'string') stop(index);
    await act(() => {
      // The identity proof runs again on the list as it stands at the click, so a list
      // that changed after the read, such as a curriculum added to the code, is stale.
      const fresh = resolveOptions(doc, which);
      const option = fresh?.[index];
      return fresh !== null &&
        option !== undefined &&
        pickOption(fresh, half) === index
        ? chooseOption(option.control)
        : 'stale';
    });
    await waitFor(
      (observation) =>
        selected(observation, which)?.section === half.code &&
        resolveOptions(doc, which) === null
          ? true
          : null,
      timing.settle,
      'notRecognised',
    );
  }

  // The add card can be loading as a subject starts: the host reads the student's credits
  // when the panel mounts again after its period check, or still reads a subject the
  // student typed. The subject waits for the card as for the host's answer, and its checks
  // run on what the card settles to. The dock shows the subject waiting meanwhile, and a
  // card that never settles stops with its own sentence, since no subject was entered.
  async function settledPage(target: FillTarget): Promise<HostObservation> {
    if (read()?.card?.status === 'searching') {
      deps.onStep(target.subjectId, 'wait', []);
      await waitFor(
        (seen) => (seen.card?.status === 'searching' ? null : true),
        timing.answer,
        'cardLoading',
      );
    }
    return page();
  }

  // The press that starts a run can come while the page is busy with requests of its own,
  // such as the reads the panel makes when it mounts again or a token refresh, and one
  // can end just after the run began. A request that ends before KCP first acts cannot be
  // one KCP caused, so when the page made one in the moment before, the run first waits
  // for the count to stay the same for a moment, and counts from there. A page with no
  // such request is not made to wait. The period check the host sends on a focus is not
  // counted either way.
  async function quietPage(): Promise<void> {
    const until = now() + timing.settle;
    let seen = tripwire.count();
    let since = now();
    while (now() - since < timing.quiet && now() <= until) {
      if (deps.stopRequested()) stop('stopped');
      read();
      await sleep(timing.poll);
      const count = tripwire.count();
      if (count !== seen) {
        seen = count;
        since = now();
      }
    }
  }

  // The condition must be on screen in KCP, and have been for the whole of the least
  // time, before KCP acknowledges the dialog. KCP's card renders in its own root, which
  // the page watch does not see, so this wait reads its clock and ends the moment the
  // least time is up. The helper keeps the condition it read for the subject after the
  // dialog closes, so this is the least time the student can read it, not the only time.
  // A collapsed card, the list, another subject in focus, or the planner over the card
  // leaves the dialog for the student to read and close.
  async function conditionShown(subjectId: string): Promise<void> {
    const until = now() + timing.settle;
    for (;;) {
      if (deps.stopRequested()) stop('stopped');
      read();
      const since = deps.conditionShownSince(subjectId);
      const left = since === null ? null : since + timing.acknowledge - now();
      if (left !== null && left <= 0) return;
      if (now() > until) stop('dialogOpen');
      await sleep(Math.min(left ?? timing.poll, timing.poll));
    }
  }

  async function fillOne(target: FillTarget): Promise<boolean> {
    if (!acted && !quieted) {
      if (!tripwire.quiet(timing.quiet)) await quietPage();
      quieted = true;
    }
    let observation = await settledPage(target);
    const listed = listedState(observation, target);
    if (listed === 'listed') return false;
    if (listed === 'other') stop('listedOther');
    if (overCredits(observation, target)) stop('credits');
    const clash = listClash(observation, target, kit);
    if (clash !== null) stop(clash);
    const card = observation.card;
    const toasts = observation.toasts.length;
    if (!acted) requests = tripwire.count();
    const resume =
      card?.status === 'offered' && card.subjectId === target.subjectId;
    if (!resume) {
      if (card?.status !== 'empty') stop('fieldNotEmpty');
      deps.onStep(target.subjectId, 'enter', []);
      await act(() => {
        const field = resolveField(doc);
        return field === null ? null : enterSubjectId(field, target.id);
      });
      deps.onStep(target.subjectId, 'wait', []);
      const answer = await waitFor(
        (seen) => {
          if (seen.dialog?.kind === 'gradeNotAnnounced') return 'offered';
          if (seen.card?.status === 'offered') return 'offered';
          const fresh = seen.toasts.slice(toasts);
          if (fresh.some((toast) => toast.kind === 'alreadyListed')) {
            return 'listedOther';
          }
          if (fresh.some((toast) => toast.kind === 'refused')) return 'refused';
          return fresh.length > 0 ? 'notRecognised' : null;
        },
        timing.answer,
        'noAnswer',
      );
      if (tripwire.count() - requests > 1) stop('pageRequest');
      if (answer !== 'offered') stop(answer);
      requests = tripwire.count();
    }
    observation = read() ?? stop('notRecognised');
    if (observation.dialog?.kind === 'gradeNotAnnounced') {
      // Owner answer 5B: show the condition in the dock first, then acknowledge.
      deps.onStep(
        target.subjectId,
        'conditional',
        observation.dialog.prerequisites,
      );
      await conditionShown(target.subjectId);
      await act(() => {
        const button = resolveAcknowledge(doc);
        return button === null ? null : pressAcknowledge(button);
      });
      await waitFor(
        (seen) => (seen.dialog === null ? true : null),
        timing.settle,
        'notRecognised',
      );
    }
    await chooseHalf(target, 'primary', target.primary);
    const row = page().card;
    if (target.practice !== null && row?.practiceSelect === true) {
      await chooseHalf(target, 'practice', target.practice);
    } else if (row === null || !practiceHolds(row, target)) {
      stop(target.practice === null ? 'practiceUnplanned' : 'practiceMissing');
    }
    observation = await waitFor(
      (seen) => (seen.card?.colour === 'pending' ? null : seen),
      timing.settle,
      'notRecognised',
    );
    const clashed = observation.toasts
      .slice(toasts)
      .some((toast) => toast.kind === 'clash');
    if (observation.card?.colour === 'clash' || clashed) stop('hostClash');
    if (overSubscribed(observation) && !deps.allowFull.has(target.subjectId)) {
      stop('full');
    }
    if (tripwire.count() !== requests) stop('pageRequest');
    const seenToasts = observation.toasts.length;
    deps.onStep(target.subjectId, 'add', []);
    await act(() => {
      // The whole selection is checked again in the same task as the press.
      const seen = read();
      const row = seen?.card;
      const holds =
        seen !== null &&
        row !== null &&
        row !== undefined &&
        pageBlock(seen, plan) === null &&
        seen.dialog === null &&
        seen.toasts.length === seenToasts &&
        row.subjectId === target.subjectId &&
        row.colour === 'fits' &&
        row.primary?.section === target.primary.code &&
        practiceHolds(row, target);
      const add = holds ? resolveAdd(doc) : null;
      return !holds ? 'stale' : add === null ? null : pressAdd(add);
    });
    await waitFor(
      (seen) =>
        listedState(seen, target) === 'listed' && seen.card?.status === 'empty'
          ? true
          : null,
      timing.settle,
      'notRecognised',
    );
    if (tripwire.count() !== requests) stop('pageRequest');
    return true;
  }

  let current: string | null = null;
  let filled = 0;
  try {
    for (const target of deps.targets) {
      current = target.subjectId;
      if (await fillOne(target)) filled += 1;
    }
    return { status: 'done', filled };
  } catch (error) {
    if (error instanceof Stop) {
      return { status: 'stopped', subjectId: current, reason: error.reason };
    }
    throw error;
  } finally {
    watch.stop();
  }
}
