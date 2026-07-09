// The plan store. It holds every saved plan and which one is active, and mirrors the
// active plan's entries at the top level so the catalog and grid keep reading the same
// `entries` and placed sections as before the store learned about multiple plans.
// Mutations run through the pure transaction primitive against the active plan, and a
// mutation keeps what it added and removed as a pending undo for the feedback strip.
// When there is no active plan, the first add creates one for the term of the search
// that produced the section, so the first add never hits a wall. Persistence over
// storage arrives with the persistence hook, behind this same interface.

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
import {
  acknowledgeEntry,
  defaultPlanName,
  duplicatePlanOf,
  makePlan,
  mergeReconciled,
  mostRecentlyUpdated,
  replaceEntries,
} from './planActions';

/** What the last mutation did, held for a short undo window. The kind drives the
 * feedback wording so a move does not read as a removal. */
export interface UndoRecord {
  kind: 'remove' | 'move' | 'swap';
  added: PlanEntry[];
  removed: PlanEntry[];
}

export interface PlanStore {
  /** Every saved plan, each scoped to one year and semester. */
  plans: Plan[];
  /** The plan the catalog and grid act on, or null when none exist yet. */
  activePlanId: string | null;
  /** The active plan's entries, mirrored so existing readers stay unchanged. */
  entries: PlanEntry[];
  /** The last mutation's added and removed entries, held to reverse it, or null. */
  pendingUndo: UndoRecord | null;
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
  /** Create a plan for a term and make it active, returning its id. */
  createPlan: (name: string, term: Term) => string;
  renamePlan: (id: string, name: string) => void;
  /** Copy a plan under a new name and make the copy active. */
  duplicatePlan: (id: string, name: string) => void;
  /** Delete a plan; if it was active, fall back to the most recently updated one. */
  deletePlan: (id: string) => void;
  setActivePlan: (id: string) => void;
  /** Replace the plan list, activating the most recently updated plan. */
  hydrate: (plans: Plan[]) => void;
  /** Fold reconciled entries into a plan by durable identity, clearing any undo. */
  applyRevalidation: (planId: string, reconciled: PlanEntry[]) => void;
  /** Mark a changed entry verified once the user acknowledges its change. */
  acknowledge: (teachTableId: string) => void;
}

/** Injected so tests get deterministic ids and timestamps. */
export interface PlanStoreDeps {
  now: () => string;
  uuid: () => string;
}

// A shared empty array so the mirrored entries keep a stable reference when no plan
// is active, which avoids a needless re-render of the subscribing components.
const EMPTY_ENTRIES: PlanEntry[] = [];

function activeEntriesOf(
  plans: Plan[],
  activePlanId: string | null,
): PlanEntry[] {
  return (
    plans.find((plan) => plan.id === activePlanId)?.entries ?? EMPTY_ENTRIES
  );
}

export function createPlanStore(deps: PlanStoreDeps = defaultDeps()) {
  return createStore<PlanStore>((set, get) => ({
    plans: [],
    activePlanId: null,
    entries: EMPTY_ENTRIES,
    pendingUndo: null,

    add: (course, section, sourceQuery) => {
      const now = deps.now();
      const state = get();
      const active = state.plans.find((plan) => plan.id === state.activePlanId);
      // An existing plan fixes the term; the first add takes the section's own term,
      // so auto-create never rejects itself as cross term.
      const planTerm: Term =
        active !== undefined
          ? { year: active.year, semester: active.semester }
          : termFromSourceQueryParams(sourceQuery.params);
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
      const active = state.plans.find((plan) => plan.id === state.activePlanId);
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
            removed: outcome.result.removed,
          },
        });
      }
    },

    apply: (removeIds, add, kind) => {
      const now = deps.now();
      const state = get();
      const active = state.plans.find((plan) => plan.id === state.activePlanId);
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
      const active = state.plans.find((plan) => plan.id === state.activePlanId);
      if (pending === null || active === undefined) {
        return;
      }
      const addedIds = new Set(
        pending.added.map((entry) => entry.teachTableId),
      );
      const entries = [
        ...active.entries.filter((entry) => !addedIds.has(entry.teachTableId)),
        ...pending.removed,
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

    createPlan: (name, term) => {
      const plan = makePlan(deps.uuid(), name, term, deps.now());
      set((state) => ({
        plans: [...state.plans, plan],
        activePlanId: plan.id,
        entries: plan.entries,
        pendingUndo: null,
      }));
      return plan.id;
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
      const state = get();
      const source = state.plans.find((plan) => plan.id === id);
      if (source === undefined) {
        return;
      }
      const copy = duplicatePlanOf(source, deps.uuid(), name, deps.now());
      set({
        plans: [...state.plans, copy],
        activePlanId: copy.id,
        entries: copy.entries,
        pendingUndo: null,
      });
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
        const active = state.plans.find(
          (plan) => plan.id === state.activePlanId,
        );
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
  return useStore(
    planStore,
    (state) =>
      state.plans.find((plan) => plan.id === state.activePlanId) ?? null,
  );
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
