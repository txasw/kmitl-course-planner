// Which plan the registration helper shows. The helper follows the term the page
// registers, not the planner's active plan: the plan of that term the student picked on
// this visit, else the active plan when it is of that term, else the one most recently
// updated. Choosing never changes the planner's active plan.
//
// Until the page term is read the helper names no plan at all while a reading may still
// bring it, so a reload never shows a plan of another term over a page still loading. Only
// once no reading can bring the term (the observer is off, the wait for it ran out, or the
// page is one KCP does not read) does the helper fall back: to a plan of the term this
// document last read from the page, else to the active plan. A fallback is never proof of
// the page's term, so it is marked unconfirmed and the card names the plan's own term
// beside it; a term read from the page later replaces it.

import type { Plan } from '../domain/plan';
import { termsEqual, type Term } from '../routing/academicTerms';

export type HelperPlanPick =
  | {
      kind: 'plan';
      plan: Plan;
      termPlans: Plan[];
      /** Whether the plan is of the term this page shows, as read from the page. */
      confirmed: boolean;
    }
  | { kind: 'noPlanForTerm'; term: Term }
  /** The page term may still arrive, so no plan is named yet. */
  | { kind: 'reading' }
  | { kind: 'none' };

export interface HelperPlanInput {
  plans: readonly Plan[];
  activePlanId: string | null;
  /** The term the page shows, or null while KCP cannot read it. */
  pageTerm: Term | null;
  /** Whether a reading of the page may still bring its term. */
  termPending: boolean;
  /** The term this document last read from the page, a hint for the fallback only. */
  rememberedTerm: Term | null;
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

function ofTerm(plans: readonly Plan[], term: Term): Plan[] {
  return plans.filter((plan) =>
    termsEqual({ year: plan.year, semester: plan.semester }, term),
  );
}

function choose(
  termPlans: readonly Plan[],
  pickedPlanId: string | null,
  activePlanId: string | null,
): Plan | null {
  return (
    termPlans.find((plan) => plan.id === pickedPlanId) ??
    termPlans.find((plan) => plan.id === activePlanId) ??
    latest(termPlans)
  );
}

export function pickHelperPlan(input: HelperPlanInput): HelperPlanPick {
  const { plans, activePlanId, pageTerm, termPending, pickedPlanId } = input;
  if (pageTerm === null) {
    if (termPending) return { kind: 'reading' };
    const remembered =
      input.rememberedTerm === null ? [] : ofTerm(plans, input.rememberedTerm);
    const hinted = choose(remembered, pickedPlanId, activePlanId);
    if (hinted !== null) {
      return {
        kind: 'plan',
        plan: hinted,
        termPlans: remembered,
        confirmed: false,
      };
    }
    const active = plans.find((plan) => plan.id === activePlanId) ?? null;
    return active === null
      ? { kind: 'none' }
      : { kind: 'plan', plan: active, termPlans: [active], confirmed: false };
  }
  const termPlans = ofTerm(plans, pageTerm);
  const chosen = choose(termPlans, pickedPlanId, activePlanId);
  return chosen === null
    ? { kind: 'noPlanForTerm', term: pageTerm }
    : { kind: 'plan', plan: chosen, termPlans, confirmed: true };
}
