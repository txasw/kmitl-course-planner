// Starts and cancels the prepare action for the panel, one run per document, and reports
// its progress and outcome through the helper store, one toast, and the status line of
// the panel's one status region (ADR-0048). The student presses the action; nothing here
// starts a run on its own.

import type { Plan } from '@/lib/domain/plan';
import type { TypedSend } from '@/lib/messaging/sendTyped';
import type { Translate } from '@/lib/i18n/t';
import { isQuietRoute } from '@/features/shell/quietRoute';
import { statusStore } from '@/features/shell/statusStore';
import { toastStore } from '@/features/shell/toastStore';
import { uiStore } from '@/features/shell/uiStore';
import { prepareRegistrationKit, type PrepareHandle } from './prepareKit';
import { regisStore } from './regisStore';

let current: PrepareHandle | null = null;

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Run the prepare action for a plan, unless a run is already in flight. */
export function startPrepare(plan: Plan, send: TypedSend, t: Translate): void {
  if (current !== null) return;
  const store = regisStore.getState();
  const handle = prepareRegistrationKit(plan, {
    send,
    now: () => new Date().toISOString(),
    pause,
    isQuiet: isQuietRoute,
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
      // A refusal can only come from a registration page opened mid run, which the
      // student reads as a stop, so it reports as one.
      store.setRun({ status: 'cancelled', planId: plan.id });
      statusStore.getState().say(t('regis.prepareCancelled'));
    }
  });
}

/** Stop the run in flight, if any. */
export function cancelPrepare(): void {
  current?.cancel();
}
