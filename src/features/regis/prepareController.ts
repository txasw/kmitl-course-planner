// Starts and cancels the prepare action, one run per document, and reports its progress
// and outcome through the regis store, one toast, the status line of the panel's one
// status region (ADR-0048), and the helper's live region. The student presses the action;
// nothing here starts a run on its own, and a failed read is never retried. The prepare
// card in the planner starts it at a calm time only; the helper's own row may also start
// it on the pre registration page, from a trusted press, while no fill run is active
// (ADR-0076), and every read still goes through the background gateway.

import type { Plan } from '@/lib/domain/plan';
import type { CoreSend } from '@/lib/messaging/envelope';
import type { Translate } from '@/lib/i18n/t';
import {
  prepareRefused,
  type PrepareSource,
} from '@/lib/routing/registrationRoute';
import { readLocationHash } from '@/features/shell/hostLocation';
import { statusStore } from '@/features/shell/statusStore';
import { toastStore } from '@/features/shell/toastStore';
import { uiStore } from '@/features/shell/uiStore';
import { fillStore } from './fill/fillRun';
import { announce } from './helperStore';
import { prepareRegistrationKit, type PrepareHandle } from './prepareKit';
import { regisStore } from './regisStore';

let current: PrepareHandle | null = null;

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Run the prepare action for a plan, unless a run is already in flight. */
export function startPrepare(
  plan: Plan,
  send: CoreSend,
  t: Translate,
  source: PrepareSource = 'planner',
): void {
  if (current !== null) return;
  const store = regisStore.getState();
  const handle = prepareRegistrationKit(plan, {
    send,
    now: () => new Date().toISOString(),
    pause,
    isQuiet: () => prepareRefused(readLocationHash(), source),
    profileCurriculum:
      uiStore.getState().curriculumProfile?.curriculumId ?? null,
    onProgress: (done, total) => {
      store.setRun({ status: 'running', planId: plan.id, done, total });
    },
  });
  current = handle;
  void handle.result.then((outcome) => {
    current = null;
    if (outcome.status === 'done') {
      regisStore.getState().saveKit(outcome.kit);
      store.setRun({ status: 'done', planId: plan.id });
      toastStore.getState().show('success', t('regis.prepareDone'));
    } else if (outcome.status === 'failed') {
      store.setRun({ status: 'failed', planId: plan.id });
      toastStore.getState().show('error', t('regis.prepareFailed'));
    } else {
      // A refusal can only come from a page that refuses prepare opened mid run, which
      // the student reads as a stop, so it reports as one.
      store.setRun({ status: 'cancelled', planId: plan.id });
      statusStore.getState().say(t('regis.prepareCancelled'));
      announce(t('regis.prepareCancelled'));
    }
  });
}

/**
 * Start the prepare action from the helper's own row, for the press of its button: only a
 * trusted press, only where the helper may prepare, and never while a fill run is active.
 * Returns whether a run started.
 */
export function startHelperPrepare(
  event: { isTrusted: boolean },
  plan: Plan,
  send: CoreSend,
  t: Translate,
): boolean {
  if (!event.isTrusted || current !== null) return false;
  if (prepareRefused(readLocationHash(), 'helper')) return false;
  if (fillStore.getState().run.status === 'running') return false;
  startPrepare(plan, send, t, 'helper');
  return true;
}

/** Stop the run in flight, if any. */
export function cancelPrepare(): void {
  current?.cancel();
}
