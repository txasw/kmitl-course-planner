// The autosave state of the plan list, written by the persistence hook and read by the
// header save indicator, which shows only a failed save. It is off until the hook
// attaches its autosave, which never happens for a refused newer schema, so the
// indicator never offers a save that cannot run. The hook also hands over its retry, so
// the indicator and the failure toast run the same save. It is separate from the plan
// store so a save outcome never counts as a plan change that would schedule another save.
import { createStore } from 'zustand/vanilla';

export type AutosaveStatus = 'off' | 'saving' | 'saved' | 'failed';

export interface AutosaveState {
  status: AutosaveStatus;
  /** Saves the current plan list now, or null while autosave is off. */
  retry: (() => void) | null;
  setStatus: (status: AutosaveStatus) => void;
  /** Turns autosave on with the plan list as stored and the retry to offer. */
  attach: (retry: () => void) => void;
  detach: () => void;
}

/**
 * The id of the plan switcher trigger, where focus lands after a retry, from the toast or
 * the save indicator, since the indicator leaves as soon as the retry starts saving.
 */
export const PLAN_SWITCHER_TRIGGER_ID = 'kcp-plan-switcher';

export function createAutosaveStore() {
  return createStore<AutosaveState>((set) => ({
    status: 'off',
    retry: null,
    setStatus: (status) => {
      set({ status });
    },
    attach: (retry) => {
      set({ status: 'saved', retry });
    },
    detach: () => {
      set({ status: 'off', retry: null });
    },
  }));
}

/** The single store instance the persistence hook and the save indicator share. */
export const autosaveStore = createAutosaveStore();
