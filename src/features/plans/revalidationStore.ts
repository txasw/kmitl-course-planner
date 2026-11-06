// The transient result of the latest revalidation per plan, held in memory for the
// summary banner, the updates dialog's check again link, and the block popover to read.
// It is not persisted: the durable outcome lives on the plan entries as their
// verification status and open review, while this store carries the one time old versus
// new detail of a run. The updates dialog's open state lives here too, so the banner and
// the pre share notice can both ask for the dialog the planner panel renders.

import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { ReconcileReport } from '@/lib/planner/reconcile';
import { planStore } from './planStore';

export type RevalidationStatus = 'running' | 'done' | 'partial' | 'offline';

export interface RevalidationRun {
  status: RevalidationStatus;
  /** The reconcile report, or null while running or when the run could not reach the
   * service. */
  report: ReconcileReport | null;
}

export interface RevalidationStore {
  runs: Record<string, RevalidationRun>;
  setRun: (planId: string, run: RevalidationRun) => void;
  /** Whether the updates dialog for the active plan is open. */
  updatesOpen: boolean;
  setUpdatesOpen: (open: boolean) => void;
}

export function createRevalidationStore() {
  return createStore<RevalidationStore>((set) => ({
    runs: {},
    setRun: (planId, run) => {
      set((state) => ({ runs: { ...state.runs, [planId]: run } }));
    },
    updatesOpen: false,
    setUpdatesOpen: (updatesOpen) => {
      set({ updatesOpen });
    },
  }));
}

/** The single revalidation store instance the banner and the updates dialog read. */
export const revalidationStore = createRevalidationStore();

/** The latest run for the active plan, or null when there is none. */
export function useActiveRun(): RevalidationRun | null {
  const activePlanId = useStore(planStore, (state) => state.activePlanId);
  const runs = useStore(revalidationStore, (state) => state.runs);
  return activePlanId === null ? null : (runs[activePlanId] ?? null);
}
