// Which plan the registration helper shows. The helper follows the term the page
// registers, not the planner's active plan: the plan of that term the student picked on
// this visit, else the active plan when it is of that term, else the one most recently
// updated. Choosing never changes the planner's active plan. While the page term is not
// known the helper falls back to the active plan, as before.

import type { Plan } from '../domain/plan';
import { termsEqual, type Term } from '../routing/academicTerms';

export type HelperPlanPick =
  | { kind: 'plan'; plan: Plan; termPlans: Plan[] }
  | { kind: 'noPlanForTerm'; term: Term }
  | { kind: 'none' };

export interface HelperPlanInput {
  plans: readonly Plan[];
  activePlanId: string | null;
  /** The term the page shows, or null while KCP cannot read it. */
  pageTerm: Term | null;
  /** The plan the student picked in the helper on this visit, or null. */
  pickedPlanId: string | null;
}

function latest(plans: readonly Plan[]): Plan | null {
  let best: Plan | null = null;
  for (const plan of plans) {
    if (best === null || plan.updatedAt > best.updatedAt) best = plan;
  }
  return best;
}

export function pickHelperPlan(input: HelperPlanInput): HelperPlanPick {
  const { plans, activePlanId, pageTerm, pickedPlanId } = input;
  const active = plans.find((plan) => plan.id === activePlanId) ?? null;
  if (pageTerm === null) {
    return active === null
      ? { kind: 'none' }
      : { kind: 'plan', plan: active, termPlans: [active] };
  }
  const termPlans = plans.filter((plan) =>
    termsEqual({ year: plan.year, semester: plan.semester }, pageTerm),
  );
  const chosen =
    termPlans.find((plan) => plan.id === pickedPlanId) ??
    termPlans.find((plan) => plan.id === activePlanId) ??
    latest(termPlans);
  return chosen === null
    ? { kind: 'noPlanForTerm', term: pageTerm }
    : { kind: 'plan', plan: chosen, termPlans };
}
