// The transient result of the latest revalidation per plan, held in memory for the
// summary banner, the detail sheet, and the block popover to read. It is not
// persisted: the durable outcome lives on the plan entries as their verification
// status, while this store carries the one time old versus new detail of a run.

import { createStore } from 'zustand/vanilla';
import type { ReconcileReport } from '@/lib/planner/revalidate';

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
}

export function createRevalidationStore() {
  return createStore<RevalidationStore>((set) => ({
    runs: {},
    setRun: (planId, run) => {
      set((state) => ({ runs: { ...state.runs, [planId]: run } }));
    },
  }));
}

/** The single revalidation store instance the banner and sheet read. */
export const revalidationStore = createRevalidationStore();
