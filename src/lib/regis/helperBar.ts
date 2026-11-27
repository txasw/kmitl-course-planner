// The one bar under the helper card's header, and whether the helper offers Prepare data
// in it (ADR-0076), as pure functions, so the helper's own bar and the planner's prepare
// card read the same answer. The planner card points the student to the helper's press
// only where the helper shows that press for the very plan the card would prepare;
// anywhere else it points to the course search page.

import type { ObserverHealth } from './observerHealth';
import type { CompanionRoute } from './route';

/**
 * The bar under the card's header: a page KCP cannot read, a page of another term, or a
 * plan with no fresh data prepared, first first.
 */
export type HelperBar = 'stale' | 'termMismatch' | 'kit';

/** Whether the helper's page cannot be read now. Only pre registration is ever read. */
export function pageStale(
  route: CompanionRoute | null,
  health: ObserverHealth,
): boolean {
  return (
    route === 'preRegistration' &&
    (health.status === 'degraded' || health.status === 'off')
  );
}

export function helperBar(facts: {
  stale: boolean;
  termMismatch: boolean;
  /** Whether a fresh kit backs the checklist. */
  hasKit: boolean;
}): HelperBar | null {
  if (facts.stale) return 'stale';
  if (facts.termMismatch) return 'termMismatch';
  return facts.hasKit ? null : 'kit';
}

export interface PrepareHereFacts {
  route: CompanionRoute | null;
  /** Whether the helper's plan is of the term read from the page. */
  confirmed: boolean;
  /** The bar the helper shows now. */
  bar: HelperBar | null;
  /** Whether the plan in question is the one the helper follows. */
  samePlan: boolean;
}

/**
 * Whether the helper offers Prepare data for a plan: on pre registration only, for a plan
 * of the term read from the page, while the helper shows its kit bar, and for the plan
 * the helper follows. A fallback plan may be of another term, and preparing it would read
 * that term's subjects at the registrar's busiest time. The helper's bar adds its own
 * check that the planner's search is connected.
 */
export function canPrepareInHelper(facts: PrepareHereFacts): boolean {
  return (
    facts.route === 'preRegistration' &&
    facts.confirmed &&
    facts.bar === 'kit' &&
    facts.samePlan
  );
}
