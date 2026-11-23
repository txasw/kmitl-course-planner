// The lifecycle of a fill run (ADR-0078), held in memory. A run starts only from a
// student press, which it consumes, on the tested host build that no refusal latched,
// outside a staff surrogate session, and never while another run is active. It is bound
// to the page address at the press, so a hash change, a surrogate session, or a press of
// Stop ends it at the next step boundary. A refusal from the actuator latches fill off
// for the build; nothing else here is stored.

import { createStore } from 'zustand/vanilla';
import type { Plan } from '@/lib/domain/plan';
import type { FillTarget, StopReason } from '@/lib/regis/fillPlan';
import { buildKey, fillGate } from '@/lib/regis/hostBuild';
import type { RegistrationKit } from '@/lib/regis/kitSchema';
import { readLocationHash } from '@/features/shell/hostLocation';
import { regisStore } from '../regisStore';
import { readScriptNames } from '../host/hostDom';
import { isSurrogateSession } from '../host/surrogate';
import { runFill, type FillStep } from './fillEngine';
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

export const fillStore = createStore<{ run: FillRun; stop: boolean }>()(() => ({
  run: { status: 'idle' },
  stop: false,
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
  if (fillStore.getState().run.status === 'running' || isSurrogateSession()) {
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
  const outcome = await runFill({
    doc: document,
    plan: request.plan,
    kit: request.kit,
    targets,
    allowFull: new Set(request.allowFull ?? []),
    stopRequested: () =>
      fillStore.getState().stop ||
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
    tripwire,
  });
  tripwire.stop();
  const item = request.items[blocked];
  if (outcome.status === 'stopped') {
    stopped(outcome.subjectId, outcome.reason, scope);
  } else if (item !== undefined && 'reason' in item) {
    stopped(item.subjectId, item.reason, scope);
  } else {
    fillStore.setState({ run: { status: 'done', filled: outcome.filled } });
  }
}
