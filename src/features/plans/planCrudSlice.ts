// The plan list slice of the plan store: creating, renaming, duplicating, importing,
// deleting, and switching plans, and replacing the list on hydrate. Every action that
// changes which plan is active also refreshes the mirrored entries and drops the
// pending undo, since an undo only ever applies to the plan it was recorded against.
// Applying a plan suggestion lives here too because it creates a plan instead of
// editing the active one; its undo record deletes that plan again.

import type { Plan, SourceQuery } from '@/lib/domain/plan';
import { termsEqual, type Term } from '@/lib/routing/academicTerms';
import type { Suggestion } from '@/lib/planner/suggest';
import { applySuggestion } from '@/lib/planner/suggestApply';
import {
  duplicatePlanOf,
  importedPlan,
  makePlan,
  mostRecentlyUpdated,
  uniquePlanName,
} from './planActions';
import {
  activeEntriesOf,
  activePlanOf,
  EMPTY_ENTRIES,
  type GetPlanState,
  type PlanStoreDeps,
  type SetPlanState,
} from './planStoreState';

/** What applying a suggestion needs: the new plan's name and term, the suggestion, and
 * the source query of the search it came from. */
export interface SuggestionPlanInput {
  name: string;
  term: Term;
  suggestion: Suggestion;
  sourceQuery: SourceQuery;
}

export interface PlanCrudActions {
  /** Create a plan for a term and make it active, returning its id. */
  createPlan: (name: string, term: Term) => string;
  /**
   * Create a plan holding the active plan's entries plus a suggestion and make it
   * active, leaving the active plan unchanged. The active plan's entries are kept only
   * when it shares the term. Returns the created plan, or null when the add gate
   * refuses a chosen section, in which case nothing changes.
   */
  createFromSuggestion: (input: SuggestionPlanInput) => Plan | null;
  renamePlan: (id: string, name: string) => void;
  /** Copy a plan under a new name and make the copy active. */
  duplicatePlan: (id: string, name: string) => void;
  /** Add a plan imported from JSON under a fresh id, marked unverified, made active. */
  importPlan: (plan: Plan) => string;
  /** Delete a plan; if it was active, fall back to the most recently updated one. */
  deletePlan: (id: string) => void;
  setActivePlan: (id: string) => void;
  /** Replace the plan list, activating the most recently updated plan. */
  hydrate: (plans: Plan[]) => void;
}

export function createPlanCrudSlice(
  set: SetPlanState,
  get: GetPlanState,
  deps: PlanStoreDeps,
): PlanCrudActions {
  // Append a plan and make it active with no pending undo.
  const activateNew = (plan: Plan): void => {
    set((state) => ({
      plans: [...state.plans, plan],
      activePlanId: plan.id,
      entries: plan.entries,
      pendingUndo: null,
    }));
  };

  return {
    createPlan: (name, term) => {
      const plan = makePlan(deps.uuid(), name, term, deps.now());
      activateNew(plan);
      return plan.id;
    },

    createFromSuggestion: ({ name, term, suggestion, sourceQuery }) => {
      const now = deps.now();
      const state = get();
      const active = activePlanOf(state);
      const locked =
        active !== undefined &&
        termsEqual({ year: active.year, semester: active.semester }, term)
          ? active.entries.map((entry) => ({ ...entry }))
          : EMPTY_ENTRIES;
      const outcome = applySuggestion(
        locked,
        suggestion,
        sourceQuery,
        now,
        term,
      );
      if (!outcome.ok) {
        return null;
      }
      const plan: Plan = {
        ...makePlan(deps.uuid(), uniquePlanName(name, state.plans), term, now),
        entries: outcome.result.entries,
      };
      set({
        plans: [...state.plans, plan],
        activePlanId: plan.id,
        entries: plan.entries,
        pendingUndo: {
          kind: 'create',
          planId: plan.id,
          planName: plan.name,
          previousPlanId: state.activePlanId,
        },
      });
      return plan;
    },

    renamePlan: (id, name) => {
      const now = deps.now();
      set((state) => ({
        plans: state.plans.map((plan) =>
          plan.id === id ? { ...plan, name, updatedAt: now } : plan,
        ),
      }));
    },

    duplicatePlan: (id, name) => {
      const source = get().plans.find((plan) => plan.id === id);
      if (source === undefined) {
        return;
      }
      activateNew(duplicatePlanOf(source, deps.uuid(), name, deps.now()));
    },

    importPlan: (plan) => {
      const imported = importedPlan(
        plan,
        deps.uuid(),
        uniquePlanName(plan.name, get().plans),
        deps.now(),
      );
      activateNew(imported);
      return imported.id;
    },

    deletePlan: (id) => {
      set((state) => {
        const plans = state.plans.filter((plan) => plan.id !== id);
        const activePlanId =
          state.activePlanId === id
            ? (mostRecentlyUpdated(plans)?.id ?? null)
            : state.activePlanId;
        return {
          plans,
          activePlanId,
          entries: activeEntriesOf(plans, activePlanId),
          pendingUndo: null,
        };
      });
    },

    setActivePlan: (id) => {
      set((state) => {
        if (!state.plans.some((plan) => plan.id === id)) {
          return {};
        }
        return {
          activePlanId: id,
          entries: activeEntriesOf(state.plans, id),
          pendingUndo: null,
        };
      });
    },

    hydrate: (plans) => {
      const active = mostRecentlyUpdated(plans);
      set({
        plans,
        activePlanId: active?.id ?? null,
        entries: active?.entries ?? EMPTY_ENTRIES,
        pendingUndo: null,
      });
    },
  };
}
