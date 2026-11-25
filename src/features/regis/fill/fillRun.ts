// The lifecycle of a fill run (ADR-0078), held in memory. A run starts only from a
// student press, which it consumes, on the tested host build that no refusal latched,
// outside a staff surrogate session, while the student's fill switch is on, while the
// helper shows and the planner is closed, and never while another run is active. It is
// bound to the page address at the press, so a hash change, a surrogate session, a press
// of Stop, the switch turned off, Hide on this page, or the planner opening over the page
// ends it at the next step boundary, as Stop does. A refusal from the actuator latches
// fill off for the build; nothing else here is stored.

import { createStore } from 'zustand/vanilla';
import type { Plan } from '@/lib/domain/plan';
import type { FillTarget, StopReason } from '@/lib/regis/fillPlan';
import { buildKey, fillGate } from '@/lib/regis/hostBuild';
import type { RegistrationKit } from '@/lib/regis/kitSchema';
import { readLocationHash } from '@/features/shell/hostLocation';
import { uiStore } from '@/features/shell/uiStore';
import { helperStore } from '../helperStore';
import { regisStore } from '../regisStore';
import { readScriptNames } from '../host/hostDom';
import { isSurrogateSession } from '../host/surrogate';
import { runFill, type FillOutcome, type FillStep } from './fillEngine';
import { consumeStudentPress, type StudentPress } from './studentPress';
import { startTripwire } from './tripwire';

export type FillRun =
  | { status: 'idle' }
  | {
      status: 'running';
      subjectId: string;
      step: FillStep;
      prerequisites: readonly string[];
      done: number;
      total: number;
    }
  | {
      status: 'stopped';
      subjectId: string | null;
      reason: StopReason;
      /** The subjects the stopped run covered, for Continue. */
      scope: readonly string[];
    }
  | { status: 'done'; filled: number };

export const fillStore = createStore<{
  run: FillRun;
  stop: boolean;
  /** The subject whose condition KCP's card shows now, and since when (owner answer 5B). */
  shown: { subjectId: string; at: number } | null;
}>()(() => ({
  run: { status: 'idle' },
  stop: false,
  shown: null,
}));

export function requestStop(): void {
  fillStore.setState({ stop: true });
}

export interface FillRequest {
  plan: Plan;
  kit: RegistrationKit;
  /** The subjects the press named, in order, each a target or the reason it is not one. */
  items: readonly (FillTarget | { subjectId: string; reason: StopReason })[];
  allowFull?: readonly string[];
}

/**
 * Whether the student has taken the helper off the page: hidden it here, or opened the
 * planner over it. Either leaves no Stop on screen, so the run ends as if Stop was pressed.
 */
function helperAway(): boolean {
  return helperStore.getState().hidden || uiStore.getState().isOpen;
}

function stopped(
  subjectId: string | null,
  reason: StopReason,
  scope: readonly string[],
): void {
  fillStore.setState({ run: { status: 'stopped', subjectId, reason, scope } });
}

export async function startFill(
  press: StudentPress,
  request: FillRequest,
): Promise<void> {
  if (!consumeStudentPress(press)) return;
  if (
    fillStore.getState().run.status === 'running' ||
    regisStore.getState().fill.off ||
    helperAway() ||
    isSurrogateSession()
  ) {
    return;
  }
  const scope = request.items.map((item) => item.subjectId);
  const names = readScriptNames(document);
  const gate = fillGate(names, regisStore.getState().fill.latched);
  if (gate !== 'ok') {
    stopped(null, gate, scope);
    return;
  }
  // Fill all stops at the first subject that cannot be filled (owner answer 3A).
  const blocked = request.items.findIndex((item) => 'reason' in item);
  const targets = request.items
    .slice(0, blocked < 0 ? undefined : blocked)
    .filter((item): item is FillTarget => !('reason' in item));
  const hash = readLocationHash();
  const tripwire = startTripwire();
  fillStore.setState({
    stop: false,
    run: {
      status: 'running',
      subjectId: targets[0]?.subjectId ?? '',
      step: 'enter',
      prerequisites: [],
      done: 0,
      total: targets.length,
    },
  });
  // A fault inside the run ends it as a stop the student can read, never as a run that
  // stays running with a Stop that no step reads and the fill buttons hidden.
  let outcome: FillOutcome;
  try {
    outcome = await runFill({
      doc: document,
      plan: request.plan,
      kit: request.kit,
      targets,
      allowFull: new Set(request.allowFull ?? []),
      stopRequested: () =>
        fillStore.getState().stop ||
        regisStore.getState().fill.off ||
        helperAway() ||
        readLocationHash() !== hash ||
        isSurrogateSession(),
      onStep: (subjectId, step, prerequisites) => {
        fillStore.setState({
          run: {
            status: 'running',
            subjectId,
            step,
            prerequisites,
            done: targets.findIndex((target) => target.subjectId === subjectId),
            total: targets.length,
          },
        });
      },
      onRefusal: () => {
        const key = buildKey(names);
        if (key !== null) regisStore.getState().latchBuild(key);
      },
      conditionShownSince: (subjectId) => {
        const { shown } = fillStore.getState();
        return shown?.subjectId === subjectId ? shown.at : null;
      },
      tripwire,
    });
  } catch {
    outcome = { status: 'stopped', subjectId: null, reason: 'notRecognised' };
  } finally {
    tripwire.stop();
  }
  const item = request.items[blocked];
  if (outcome.status === 'stopped') {
    stopped(outcome.subjectId, outcome.reason, scope);
  } else if (item !== undefined && 'reason' in item) {
    stopped(item.subjectId, item.reason, scope);
  } else {
    fillStore.setState({ run: { status: 'done', filled: outcome.filled } });
  }
}
