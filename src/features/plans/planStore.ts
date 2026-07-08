// The minimal plan store read interface. The catalog computes each section's
// state against the placed sections, so it needs to read the plan even before the
// plan feature is built. This store holds the entries and derives the placed
// sections; it carries no mutations or persistence yet. Phase 5 adds add and
// remove, Phase 6 adds persistence, both behind this same read surface, so the
// catalog plugs in without rework.

import { useMemo } from 'react';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { snapshotToSection, type PlanEntry } from '@/lib/domain/plan';
import type { Section } from '@/lib/domain/types';

export interface PlanStore {
  entries: PlanEntry[];
}

export function createPlanStore() {
  return createStore<PlanStore>(() => ({ entries: [] }));
}

/** The single plan store instance the catalog reads. */
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
