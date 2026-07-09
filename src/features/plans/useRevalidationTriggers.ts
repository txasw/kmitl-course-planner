// Wires the automatic revalidation triggers: opening the overlay and switching the
// active plan each revalidate the active plan, throttled to once per plan per ten
// minutes. A manual refresh runs from the banner and bypasses the throttle. The hook
// mounts once at the app root and reads the injected send so it stays off the search
// store's live catalog.

import { useEffect } from 'react';
import type { Plan } from '@/lib/domain/plan';
import type { TypedSend } from '@/lib/messaging/sendTyped';
import { uiStore } from '@/features/shell/uiStore';
import { planStore } from './planStore';
import { revalidatePlanNow, shouldRevalidate } from './revalidationController';

function activePlan(): Plan | null {
  const state = planStore.getState();
  return state.plans.find((plan) => plan.id === state.activePlanId) ?? null;
}

export function useRevalidationTriggers(send: TypedSend): void {
  useEffect(() => {
    const deps = { send, now: () => new Date().toISOString() };
    const maybeRun = (): void => {
      if (!uiStore.getState().isOpen) {
        return;
      }
      const plan = activePlan();
      if (plan === null || !shouldRevalidate(plan, Date.now())) {
        return;
      }
      void revalidatePlanNow(plan, deps, false);
    };
    // Check once in case the overlay is already open when the hook mounts.
    maybeRun();
    const unsubscribeUi = uiStore.subscribe((state, previous) => {
      if (state.isOpen && !previous.isOpen) {
        maybeRun();
      }
    });
    const unsubscribePlan = planStore.subscribe((state, previous) => {
      if (state.activePlanId !== previous.activePlanId) {
        maybeRun();
      }
    });
    return () => {
      unsubscribeUi();
      unsubscribePlan();
    };
  }, [send]);
}
