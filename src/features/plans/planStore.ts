// The plan store. It holds every saved plan and which one is active, and mirrors the
// active plan's entries at the top level so the catalog and grid keep reading the same
// `entries` and placed sections as before the store learned about multiple plans. The
// plan list actions live in the CRUD slice; this module composes it with the entry
// mutations into one store, so callers keep a single store and a single API.
// Mutations run through the pure transaction primitive against the active plan, and a
// mutation keeps what it added and removed as a pending undo for the feedback strip.
// When there is no active plan, the first add creates one for the term of the search
// that produced the section, so the first add never hits a wall.

import { useMemo } from 'react';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import {
  snapshotToSection,
  type Plan,
  type PlanEntry,
  type SourceQuery,
} from '@/lib/domain/plan';
import type { Course, Section } from '@/lib/domain/types';
import type { Term } from '@/lib/routing/academicTerms';
import { termFromSourceQueryParams } from '@/lib/planner/sourceQuery';
import {
  addSectionGroup,
  applyPlanTransaction,
  type AddInput,
  type AddOutcome,
  type TransactionOutcome,
} from '@/lib/planner/transaction';
import { createPlanCrudSlice, type PlanCrudActions } from './planCrudSlice';
import {
  acknowledgeEntry,
  defaultPlanName,
  makePlan,
  mergeReconciled,
  mostRecentlyUpdated,
  replaceEntries,
} from './planActions';
import {
  activeEntriesOf,
  activePlanOf,
  EMPTY_ENTRIES,
  type PlanStoreDeps,
  type PlanStoreState,
} from './planStoreState';

export type { SuggestionPlanInput } from './planCrudSlice';
export type {
  CreatedPlanUndoRecord,
  EntryUndoRecord,
  PlanStoreDeps,
  UndoRecord,
} from './planStoreState';

export interface PlanEntryActions {
  add: (
    course: Course,
    section: Section,
    sourceQuery: SourceQuery,
  ) => AddOutcome;
  remove: (teachTableId: string) => void;
  apply: (
    removeIds: string[],
    add: AddInput,
    kind: 'move' | 'swap',
  ) => TransactionOutcome;
  undo: () => void;
  clearUndo: () => void;
  /** Fold reconciled entries into a plan by durable identity, clearing any undo. */
  applyRevalidation: (planId: string, reconciled: PlanEntry[]) => void;
  /** Mark a changed entry verified once the user acknowledges its change. */
  acknowledge: (teachTableId: string) => void;
}

export type PlanStore = PlanStoreState & PlanCrudActions & PlanEntryActions;

export function createPlanStore(deps: PlanStoreDeps = defaultDeps()) {
  return createStore<PlanStore>((set, get) => ({
    plans: [],
    activePlanId: null,
    entries: EMPTY_ENTRIES,
    pendingUndo: null,
    ...createPlanCrudSlice(set, get, deps),

    add: (course, section, sourceQuery) => {
      const now = deps.now();
      const state = get();
      const active = activePlanOf(state);
      // An existing plan fixes the term; the first add takes the section's own term,
      // so auto-create never rejects itself as cross term.
      const planTerm: Term | null =
        active !== undefined
          ? { year: active.year, semester: active.semester }
          : termFromSourceQueryParams(sourceQuery.params);
      if (planTerm === null) {
        return { ok: false, crossTerm: { planTerm: null, incomingTerm: null } };
      }
      const outcome = addSectionGroup(
        active?.entries ?? EMPTY_ENTRIES,
        course,
        section,
        sourceQuery,
        now,
        planTerm,
      );
      if (!outcome.ok) {
        return outcome;
      }
      if (active === undefined) {
        // First add with no active plan: create one for the section's term. The plan
        // is committed only with a successful add, so a rejected first add leaves no
        // orphan empty plan behind.
        const created: Plan = {
          ...makePlan(deps.uuid(), defaultPlanName(planTerm), planTerm, now),
          entries: outcome.result.entries,
        };
        set({
          plans: [...state.plans, created],
          activePlanId: created.id,
          entries: created.entries,
          pendingUndo: null,
        });
      } else {
        set({
          plans: replaceEntries(
            state.plans,
            active.id,
            outcome.result.entries,
            now,
          ),
          entries: outcome.result.entries,
          pendingUndo: null,
        });
      }
      return outcome;
    },

    remove: (teachTableId) => {
      const now = deps.now();
      const state = get();
      const active = activePlanOf(state);
      if (active === undefined) {
        return;
      }
      const outcome = applyPlanTransaction(
        active.entries,
        [teachTableId],
        null,
        now,
        { year: active.year, semester: active.semester },
      );
      if (outcome.ok && outcome.result.removed.length > 0) {
        // Coalesce: a removal during an active removal's undo window folds into the same
        // record rather than replacing it, so one toast covers both and undo restores
        // both. Only consecutive removals coalesce; a move or swap starts a fresh record.
        const prior = state.pendingUndo;
        const removed =
          prior !== null && prior.kind === 'remove'
            ? [...prior.removed, ...outcome.result.removed]
            : outcome.result.removed;
        set({
          plans: replaceEntries(
            state.plans,
            active.id,
            outcome.result.entries,
            now,
          ),
          entries: outcome.result.entries,
          pendingUndo: {
            kind: 'remove',
            added: [],
            removed,
          },
        });
      }
    },

    apply: (removeIds, add, kind) => {
      const now = deps.now();
      const state = get();
      const active = activePlanOf(state);
      if (active === undefined) {
        // A move or swap always acts on a placed block, so an active plan exists.
        return { ok: false, conflicts: [] };
      }
      const outcome = applyPlanTransaction(
        active.entries,
        removeIds,
        add,
        now,
        {
          year: active.year,
          semester: active.semester,
        },
      );
      if (outcome.ok) {
        const { entries, added, removed } = outcome.result;
        set({
          plans: replaceEntries(state.plans, active.id, entries, now),
          entries,
          pendingUndo: { kind, added, removed },
        });
      }
      return outcome;
    },

    undo: () => {
      const now = deps.now();
      const state = get();
      const pending = state.pendingUndo;
      if (pending?.kind === 'create') {
        // Delete the created plan and return to the plan active before it, or to the
        // latest plan when that one has since been deleted.
        const plans = state.plans.filter((plan) => plan.id !== pending.planId);
        const activePlanId = plans.some(
          (plan) => plan.id === pending.previousPlanId,
        )
          ? pending.previousPlanId
          : (mostRecentlyUpdated(plans)?.id ?? null);
        set({
          plans,
          activePlanId,
          entries: activeEntriesOf(plans, activePlanId),
          pendingUndo: null,
        });
        return;
      }
      const active = activePlanOf(state);
      if (pending === null || active === undefined) {
        return;
      }
      const addedIds = new Set(
        pending.added.map((entry) => entry.teachTableId),
      );
      // Restore the removed entries in reverse order, so a coalesced record brings back
      // the most recent removal first, undoing the folds newest to oldest.
      const entries = [
        ...active.entries.filter((entry) => !addedIds.has(entry.teachTableId)),
        ...[...pending.removed].reverse(),
      ];
      set({
        plans: replaceEntries(state.plans, active.id, entries, now),
        entries,
        pendingUndo: null,
      });
    },

    clearUndo: () => {
      set({ pendingUndo: null });
    },

    applyRevalidation: (planId, reconciled) => {
      set((state) => {
        const target = state.plans.find((plan) => plan.id === planId);
        if (target === undefined) {
          return {};
        }
        // Merge by identity so a reconcile never resurrects a removed entry or drops
        // one added during the round trip. updatedAt stays, since this is not an edit.
        const entries = mergeReconciled(target.entries, reconciled);
        const plans = state.plans.map((plan) =>
          plan.id === planId ? { ...plan, entries } : plan,
        );
        if (planId !== state.activePlanId) {
          return { plans };
        }
        // The pending undo keys on teachTableId, so only a reconcile that moved a key
        // can break it; an unchanged or field only reconcile leaves the undo valid.
        const rekeyed = reconciled.some((entry) => {
          const before = target.entries.find(
            (current) =>
              current.subjectId === entry.subjectId &&
              current.section === entry.section,
          );
          return (
            before !== undefined && before.teachTableId !== entry.teachTableId
          );
        });
        return rekeyed
          ? { plans, entries, pendingUndo: null }
          : { plans, entries };
      });
    },

    acknowledge: (teachTableId) => {
      set((state) => {
        const active = activePlanOf(state);
        if (active === undefined) {
          return {};
        }
        const entries = acknowledgeEntry(active.entries, teachTableId);
        return {
          plans: state.plans.map((plan) =>
            plan.id === active.id ? { ...plan, entries } : plan,
          ),
          entries,
        };
      });
    },
  }));
}

function defaultDeps(): PlanStoreDeps {
  return {
    now: () => new Date().toISOString(),
    uuid: () => crypto.randomUUID(),
  };
}

/** The single plan store instance the catalog and grid read. */
export const planStore = createPlanStore();

/** The active plan object, or null when no plan is active. */
export function useActivePlan(): Plan | null {
  return useStore(planStore, (state) => activePlanOf(state) ?? null);
}

/**
 * The sections currently placed in the active plan, derived from entry snapshots. The
 * derivation is memoized on the entries reference so the returned array is stable
 * between renders and does not retrigger the subscribing component.
 */
export function usePlacedSections(): Section[] {
  const entries = useStore(planStore, (state) => state.entries);
  return useMemo(
    () => entries.map((entry) => snapshotToSection(entry.snapshot)),
    [entries],
  );
}
