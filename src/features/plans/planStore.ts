// The plan store. It holds every saved plan and which one is active, and mirrors the
// active plan's entries at the top level so the catalog and grid keep reading the same
// `entries` and placed sections as before the store learned about multiple plans. The
// plan list actions live in the CRUD slice and the section mutations in the entry
// slice; this module composes both into one store, so callers keep a single store
// instance and a single API.

import { useMemo } from 'react';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { snapshotToSection, type Plan } from '@/lib/domain/plan';
import type { Section } from '@/lib/domain/types';
import type { Term } from '@/lib/routing/academicTerms';
import { createPlanCrudSlice, type PlanCrudActions } from './planCrudSlice';
import { createPlanEntrySlice, type PlanEntryActions } from './planEntrySlice';
import {
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

export type PlanStore = PlanStoreState & PlanCrudActions & PlanEntryActions;

export function createPlanStore(deps: PlanStoreDeps = defaultDeps()) {
  return createStore<PlanStore>((set, get) => ({
    plans: [],
    activePlanId: null,
    entries: EMPTY_ENTRIES,
    pendingUndo: null,
    quietPlanId: null,
    ...createPlanCrudSlice(set, get, deps),
    ...createPlanEntrySlice(set, get, deps),
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

/**
 * The active plan's term, read when needed rather than subscribed to, because plans
 * hydrate on their own and a caller such as a search seed wants the latest value.
 */
export function activePlanTerm(): Term | null {
  const { plans, activePlanId } = planStore.getState();
  const active = plans.find((plan) => plan.id === activePlanId);
  return active === undefined
    ? null
    : { year: active.year, semester: active.semester };
}

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
