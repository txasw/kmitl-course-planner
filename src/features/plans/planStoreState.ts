// The state the plan store slices share: the plan list, the active plan, its mirrored
// entries, and the pending undo, plus the setter types each slice is built against. It
// lives apart from planStore.ts so the slices and the store that composes them never
// import each other.

import type { Plan, PlanEntry } from '@/lib/domain/plan';

/** What an entry mutation of the active plan did. The kind drives the feedback wording
 * so a move does not read as a removal. */
export interface EntryUndoRecord {
  kind: 'remove' | 'move' | 'swap';
  added: PlanEntry[];
  removed: PlanEntry[];
}

/** A plan a suggestion created, and the plan that was active before it. */
export interface CreatedPlanUndoRecord {
  kind: 'create';
  planId: string;
  planName: string;
  previousPlanId: string | null;
}

/** What the last mutation did, held for a short undo window. */
export type UndoRecord = EntryUndoRecord | CreatedPlanUndoRecord;

export interface PlanStoreState {
  /** Every saved plan, each scoped to one year and semester. */
  plans: Plan[];
  /** The plan the catalog and grid act on, or null when none exist yet. */
  activePlanId: string | null;
  /** The active plan's entries, mirrored so existing readers stay unchanged. */
  entries: PlanEntry[];
  /** The last mutation's added and removed entries, held to reverse it, or null. */
  pendingUndo: UndoRecord | null;
}

/** Injected so tests get deterministic ids and timestamps. */
export interface PlanStoreDeps {
  now: () => string;
  uuid: () => string;
}

/** The store setter as a slice sees it: a slice only ever writes the shared state. */
export type SetPlanState = (
  partial:
    | Partial<PlanStoreState>
    | ((state: PlanStoreState) => Partial<PlanStoreState>),
) => void;

/** The store getter as a slice sees it. */
export type GetPlanState = () => PlanStoreState;

// A shared empty array so the mirrored entries keep a stable reference when no plan
// is active, which avoids a needless re-render of the subscribing components.
export const EMPTY_ENTRIES: PlanEntry[] = [];

/** The active plan, or undefined when none is active. */
export function activePlanOf(state: PlanStoreState): Plan | undefined {
  return state.plans.find((plan) => plan.id === state.activePlanId);
}

export function activeEntriesOf(
  plans: Plan[],
  activePlanId: string | null,
): PlanEntry[] {
  return (
    plans.find((plan) => plan.id === activePlanId)?.entries ?? EMPTY_ENTRIES
  );
}
