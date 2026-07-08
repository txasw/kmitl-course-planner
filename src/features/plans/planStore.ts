// The plan store. It holds the entries and derives the placed sections the catalog
// reads, and it owns the add and remove transactions. Removing keeps the removed
// group in memory as a pending undo so the feedback strip can restore it, and the
// next mutation clears that window. Persistence to storage stays a later phase,
// behind this same interface, so the catalog and grid plug in without rework.

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
  removeEntry,
  type AddOutcome,
} from '@/lib/planner/transaction';

export interface PlanStore {
  entries: PlanEntry[];
  /** The sections most recently removed, held for a short undo window, or null. */
  pendingUndo: PlanEntry[] | null;
  add: (
    course: Course,
    section: Section,
    sourceQuery: SourceQuery,
  ) => AddOutcome;
  remove: (teachTableId: string) => void;
  undoRemove: () => void;
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
      const { entries, removed } = removeEntry(get().entries, teachTableId);
      if (removed.length > 0) {
        set({ entries, pendingUndo: removed });
      }
    },
    undoRemove: () => {
      const pending = get().pendingUndo;
      if (pending === null) {
        return;
      }
      set((state) => ({
        entries: [...state.entries, ...pending],
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
