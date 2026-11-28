// A slot in the plan menu's data row for the Prepare for registration action, which the
// registration helper fills when its readiness card mounts. The plan menu never imports
// the helper: it offers the action only while the slot holds one, so where the helper
// does not mount, as in the web app, the slot stays empty and the menu renders no item
// for it.

import { createStore } from 'zustand/vanilla';

interface PlanMenuSlotStore {
  /** Opens the helper's readiness card, or null while no helper fills the slot. */
  prepareRegistration: (() => void) | null;
  setPrepareRegistration: (action: (() => void) | null) => void;
}

export const planMenuSlotStore = createStore<PlanMenuSlotStore>((set) => ({
  prepareRegistration: null,
  setPrepareRegistration: (prepareRegistration) => {
    set({ prepareRegistration });
  },
}));
