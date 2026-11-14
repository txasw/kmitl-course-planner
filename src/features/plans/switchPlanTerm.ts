// Switch the active plan to one for a browsed term, creating it when none exists.
// A student browsing a term other than the active plan's cannot add its sections, so
// the different term row and banner offer this one action to start planning that term.
// Its label reads the same store state the action does, so it says open when a plan
// for the term exists and create when the action would make one.

import { useStore } from 'zustand';
import type { Plan } from '@/lib/domain/plan';
import type { Term } from '@/lib/routing/academicTerms';
import { termsEqual } from '@/lib/routing/academicTerms';
import { defaultPlanName, mostRecentlyUpdated } from './planActions';
import { planStore } from './planStore';

function plansForTerm(plans: readonly Plan[], term: Term): Plan[] {
  return plans.filter((plan) =>
    termsEqual({ year: plan.year, semester: plan.semester }, term),
  );
}

/** Whether the store holds a plan for the term, which picks open over create. */
export function useHasPlanForTerm(term: Term): boolean {
  return useStore(
    planStore,
    (state) => plansForTerm(state.plans, term).length > 0,
  );
}

/**
 * Make the most recently updated plan for a term active, or create one with the
 * default name when there is none. Nothing is converted or removed.
 */
export function switchOrCreatePlanForTerm(term: Term): void {
  const store = planStore.getState();
  const existing = mostRecentlyUpdated(plansForTerm(store.plans, term));
  if (existing !== null) {
    store.setActivePlan(existing.id);
  } else {
    store.createPlan(defaultPlanName(term), term);
  }
}
