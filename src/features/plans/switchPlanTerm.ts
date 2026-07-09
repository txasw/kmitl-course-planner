// Switch the active plan to one for a browsed term, creating it when none exists.
// A student browsing a term other than the active plan's cannot add its sections, so
// the different term row and banner offer this one action to start planning that term.

import type { Term } from '@/lib/routing/academicTerms';
import { termsEqual } from '@/lib/routing/academicTerms';
import { defaultPlanName, mostRecentlyUpdated } from './planActions';
import { planStore } from './planStore';

/**
 * Make the most recently updated plan for a term active, or create one with the
 * default name when there is none. Nothing is converted or removed.
 */
export function switchOrCreatePlanForTerm(term: Term): void {
  const store = planStore.getState();
  const matching = store.plans.filter((plan) =>
    termsEqual({ year: plan.year, semester: plan.semester }, term),
  );
  const existing = mostRecentlyUpdated(matching);
  if (existing !== null) {
    store.setActivePlan(existing.id);
  } else {
    store.createPlan(defaultPlanName(term), term);
  }
}
