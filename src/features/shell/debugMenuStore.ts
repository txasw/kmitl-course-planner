// A slot in the header overflow menu that a debug build fills with the entry to its
// diagnostics drawer. While the panel is open the drawer trigger leaves the screen,
// since a floating button over a full viewport panel always covers some of its text,
// and the menu offers the drawer instead (ADR-0048 amendment). The header never imports
// diagnostics code: the debug module registers its item here, and in production nothing
// registers, so the slot stays empty and the menu renders no item for it.

import { createStore } from 'zustand/vanilla';

export interface DebugMenuItem {
  label: string;
  onSelect: () => void;
}

interface DebugMenuStore {
  item: DebugMenuItem | null;
  setItem: (item: DebugMenuItem | null) => void;
}

export const debugMenuStore = createStore<DebugMenuStore>((set) => ({
  item: null,
  setItem: (item) => {
    set({ item });
  },
}));
