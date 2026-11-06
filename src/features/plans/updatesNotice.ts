// When a check opens the updates dialog on its own (ADR-0060). A run that leaves review
// items the student has not been shown asks for the dialog: an automatic run waits for an
// idle moment in edit, which useUpdatesAutoOpen watches for, and a manual check in edit
// opens it directly, since the student just asked for the check. An offline or partial
// run never asks, and while the dialog is open it lists new items as they land, so a run
// then asks nothing. Opening marks every shown item, so the dialog opens once per new set
// of items, across reloads too.

import type { Plan } from '@/lib/domain/plan';
import type { TypedSend } from '@/lib/messaging/sendTyped';
import { unnotifiedReviewIds } from '@/lib/planner/updateReview';
import { uiStore } from '@/features/shell/uiStore';
import { planStore } from './planStore';
import { revalidatePlanNow } from './revalidationController';
import {
  revalidationStore,
  type RevalidationStatus,
} from './revalidationStore';

/** Open the updates dialog for the active plan and mark its new items shown. With no new
 * item left, as when the student already opened and closed the dialog, the waiting
 * request is dropped instead. */
export function openUpdatesDialog(): void {
  const ids = unnotifiedReviewIds(planStore.getState().entries);
  if (ids.length === 0) {
    revalidationStore.getState().clearPendingOpen();
    return;
  }
  planStore.getState().markNotified(ids);
  revalidationStore.getState().setUpdatesOpen(true);
}

/** Ask for the updates dialog after a run of the given plan, if the run left new items. */
export function noticeNewReviews(
  planId: string,
  status: RevalidationStatus | null,
  manual: boolean,
): void {
  const revalidation = revalidationStore.getState();
  if (status !== 'done' || revalidation.updatesOpen) {
    return;
  }
  const { plans, activePlanId } = planStore.getState();
  const plan = plans.find((candidate) => candidate.id === planId);
  if (plan === undefined || unnotifiedReviewIds(plan.entries).length === 0) {
    return;
  }
  const direct =
    manual && activePlanId === planId && uiStore.getState().viewMode === 'edit';
  if (direct) {
    openUpdatesDialog();
  } else {
    revalidation.requestOpen(planId);
  }
}

/** Run a manual check of a plan, bypassing the throttle and the cache, then ask for the
 * dialog if the check found something new. */
export async function checkPlanNow(plan: Plan, send: TypedSend): Promise<void> {
  const status = await revalidatePlanNow(
    plan,
    { send, now: () => new Date().toISOString() },
    true,
  );
  noticeNewReviews(plan.id, status, true);
}
