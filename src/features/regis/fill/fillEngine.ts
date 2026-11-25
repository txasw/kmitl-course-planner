// The fill engine (ADR-0078): for each subject the student's press named, one at a time,
// it reads the page, asks the pure decisions what to do, acts once through the
// actuator, waits for the host's answer, and verifies it from a fresh reading before the
// next step. A wait that reaches its ceiling is a stop, never a retry, and the first stop
// ends the run (owner answer 3A). It sends no request of its own: the only request in a
// run is the host's own eligibility read after the field is filled, which the tripwire
// counts, and any other, such as the period check the host build app.a1e43722 runs every
// 60 s and on a focus, stops the run as a request of the page's own, unless it ended
// before KCP first acted, which the run waits out at its start. The subject stays to
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
import { readHostPage } from '../host/hostDom';
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
import type { Tripwire } from './tripwire';

export type FillStep =
  'enter' | 'wait' | 'conditional' | 'choose' | 'practice' | 'add';

export type FillOutcome =
  | { status: 'done'; filled: number }
  | { status: 'stopped'; subjectId: string | null; reason: StopReason };

export interface FillTiming {
  /** The least time between two events, so the student can follow. */
  pace: number;
  poll: number;
  /** How long the host may take to answer the eligibility read. */
  answer: number;
  /** How long any other host change may take. */
  settle: number;
  /** How long the condition shows in the dock before KCP acknowledges the dialog. */
  acknowledge: number;
  /**
   * How long the request count must stay the same before KCP first acts in a run,
   * waited for at most `settle`.
   */
  quiet: number;
}

export const FILL_TIMING: FillTiming = {
  pace: 250,
  poll: 100,
  answer: 60_000,
  settle: 3000,
  acknowledge: 1500,
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

  // Whether the run has acted on the page yet, so a page with no panel is a page that
  // changed under the run rather than one that was never ready.
  let acted = false;
  // The request count each step is measured from. It starts over only until KCP first
  // acts; from then on it carries from one subject to the next, so no request after an
  // action of KCP's is ever left out.
  let requests = 0;
  let quieted = false;

  // A page with no panel ends the run at once: the host can unmount the panel on its own,
  // as the period check of app.a1e43722 does when it rewrites the period, and nothing on a
  // page without one may be acted on or waited for.
  function read(): HostObservation | null {
    const reading = readHostPage(doc, planned);
    if (reading.reading === 'absent') stop(acted ? 'pageChanged' : 'notReady');
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
      await sleep(timing.poll);
    }
  }

  // Resolves the control and acts in one task, after the pace and a Stop check.
  async function act(perform: () => Actuation | null): Promise<void> {
    if (deps.stopRequested()) stop('stopped');
    await sleep(timing.pace);
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
  // run on what the card settles to.
  async function settledPage(): Promise<HostObservation> {
    if (read()?.card?.status === 'searching') {
      await waitFor(
        (seen) => (seen.card?.status === 'searching' ? null : true),
        timing.answer,
        'noAnswer',
      );
    }
    return page();
  }

  // The press that starts a run can be the click that focuses the window, and the host
  // checks its period on a focus, so that request can end just after the run began. A
  // request that ends before KCP first acts cannot be one KCP caused, so the run first
  // waits for the count to stay the same for a moment, and counts from there.
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

  async function fillOne(target: FillTarget): Promise<boolean> {
    if (!acted && !quieted) {
      await quietPage();
      quieted = true;
    }
    let observation = await settledPage();
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
      await sleep(timing.acknowledge);
      // The condition must still be on screen in KCP and have been for most of the wait.
      // A collapsed card, the list, another subject in focus, or the planner over the
      // card leaves the dialog for the student to read and close.
      const since = deps.conditionShownSince(target.subjectId);
      if (since === null || now() - since < timing.acknowledge / 2) {
        stop('dialogOpen');
      }
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
  }
}
