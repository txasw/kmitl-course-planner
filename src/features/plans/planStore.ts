// The plan store. It holds the entries and derives the placed sections the catalog
// reads, and it owns the add and remove transactions. A mutation keeps what it added
// and removed in memory as a pending undo so the feedback strip can reverse it, and
// the next mutation clears that window. Recording both sides lets one undo cover a
// plain remove today and a move or swap once those land. Persistence to storage stays
// a later phase, behind this same interface, so the catalog and grid plug in without
// rework.

import { useMemo } from 'react';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import {
  snapshotToSection,
  type PlanEntry,
  type SourceQuery,
} from '@/lib/domain/plan';
import type { Course, Section } from '@/lib/domain/types';
import {
  addSectionGroup,
  applyPlanTransaction,
  type AddInput,
  type AddOutcome,
  type TransactionOutcome,
} from '@/lib/planner/transaction';

/** What the last mutation added and removed, held for a short undo window. */
export interface UndoRecord {
  added: PlanEntry[];
  removed: PlanEntry[];
}

export interface PlanStore {
  entries: PlanEntry[];
  /** The last mutation's added and removed entries, held to reverse it, or null. */
  pendingUndo: UndoRecord | null;
  add: (
    course: Course,
    section: Section,
    sourceQuery: SourceQuery,
  ) => AddOutcome;
  remove: (teachTableId: string) => void;
  /**
   * Apply a compound move or swap: remove the listed entries and their pairs, add
   * one section and its pair, and record both sides for undo in a single update.
   * Returns the outcome so the caller can surface a residual conflict.
   */
  apply: (removeIds: string[], add: AddInput) => TransactionOutcome;
  /** Reverse the last mutation: drop what it added, restore what it removed. */
  undo: () => void;
  clearUndo: () => void;
}

export function createPlanStore() {
  return createStore<PlanStore>((set, get) => ({
    entries: [],
    pendingUndo: null,
    add: (course, section, sourceQuery) => {
      const outcome = addSectionGroup(
        get().entries,
        course,
        section,
        sourceQuery,
        new Date().toISOString(),
      );
      if (outcome.ok) {
        set({ entries: outcome.result.entries, pendingUndo: null });
      }
      return outcome;
    },
    remove: (teachTableId) => {
      const outcome = applyPlanTransaction(
        get().entries,
        [teachTableId],
        null,
        new Date().toISOString(),
      );
      if (outcome.ok && outcome.result.removed.length > 0) {
        set({
          entries: outcome.result.entries,
          pendingUndo: { added: [], removed: outcome.result.removed },
        });
      }
    },
    apply: (removeIds, add) => {
      const outcome = applyPlanTransaction(
        get().entries,
        removeIds,
        add,
        new Date().toISOString(),
      );
      if (outcome.ok) {
        const { entries, added, removed } = outcome.result;
        set({ entries, pendingUndo: { added, removed } });
      }
      return outcome;
    },
    undo: () => {
      const pending = get().pendingUndo;
      if (pending === null) {
        return;
      }
      const addedIds = new Set(
        pending.added.map((entry) => entry.teachTableId),
      );
      set((state) => ({
        entries: [
          ...state.entries.filter((entry) => !addedIds.has(entry.teachTableId)),
          ...pending.removed,
        ],
        pendingUndo: null,
      }));
    },
    clearUndo: () => {
      set({ pendingUndo: null });
    },
  }));
}

/** The single plan store instance the catalog and grid read. */
export const planStore = createPlanStore();

/**
 * The sections currently placed in the plan, derived from entry snapshots. The
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
