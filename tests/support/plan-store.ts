// Helpers for seeding the singleton plan store in component tests. The store now acts
// on the active plan, so a test that exercises a mutation must seed a real plan rather
// than a bare entries array.

import type { Plan, PlanEntry } from '../../src/lib/domain/plan';
import { planStore } from '../../src/features/plans/planStore';
import { makePlan } from './domain-builders';

/** Seed the store with one active plan holding the given entries. */
export function seedActivePlan(
  entries: PlanEntry[],
  overrides: Partial<Plan> = {},
): void {
  const plan = makePlan({ entries, ...overrides });
  planStore.setState({
    plans: [plan],
    activePlanId: plan.id,
    entries: plan.entries,
    pendingUndo: null,
  });
}

/** Reset the store to no plans. */
export function resetPlanStore(): void {
  planStore.setState({
    plans: [],
    activePlanId: null,
    entries: [],
    pendingUndo: null,
  });
}
