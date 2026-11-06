// What holds the student's attention in the panel right now, for a surface that must not
// interrupt: how many floating surfaces are open (popovers, menus, sheets, and dialogs)
// and whether focus sits inside the search form. The updates dialog reads it to wait for
// an idle moment before it opens on its own (ADR-0060). The surfaces report themselves:
// the shared popover recipe, the bottom sheet, and the modal dialog count while open, and
// the search form tracks focus within it. It is session memory only.

import { useEffect, type FocusEvent } from 'react';
import { createStore } from 'zustand/vanilla';

export interface AttentionStore {
  /** How many popovers, menus, sheets, and dialogs are open. */
  openSurfaces: number;
  /** Whether focus is inside the search form. */
  searchFocused: boolean;
  /** Count one more open surface; the returned release counts it closed, once. */
  openSurface: () => () => void;
  setSearchFocused: (focused: boolean) => void;
}

export function createAttentionStore() {
  return createStore<AttentionStore>((set) => ({
    openSurfaces: 0,
    searchFocused: false,
    openSurface: () => {
      set((state) => ({ openSurfaces: state.openSurfaces + 1 }));
      let released = false;
      return () => {
        if (released) return;
        released = true;
        set((state) => ({ openSurfaces: Math.max(0, state.openSurfaces - 1) }));
      };
    },
    setSearchFocused: (searchFocused) => {
      set({ searchFocused });
    },
  }));
}

/** The single attention store instance the surfaces write and the dialog reads. */
export const attentionStore = createAttentionStore();

/** Whether anything holds the student's attention, so an unasked surface should wait. */
export function selectAttentionHeld(state: AttentionStore): boolean {
  return state.openSurfaces > 0 || state.searchFocused;
}

/** Count a floating surface as open for as long as `open` holds and it stays mounted. */
export function useOpenSurface(open: boolean): void {
  useEffect(() => {
    if (!open) return undefined;
    return attentionStore.getState().openSurface();
  }, [open]);
}

/**
 * Focus handlers that keep the search focus flag in step with focus inside the element
 * they are spread on. Focus that moves between its own controls keeps the flag set, and
 * the flag clears when the element unmounts, so a folded form never leaves it held.
 */
export function useSearchFocusTracking(): {
  onFocus: () => void;
  onBlur: (event: FocusEvent<HTMLElement>) => void;
} {
  useEffect(
    () => () => {
      attentionStore.getState().setSearchFocused(false);
    },
    [],
  );
  return {
    onFocus: () => {
      attentionStore.getState().setSearchFocused(true);
    },
    onBlur: (event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        attentionStore.getState().setSearchFocused(false);
      }
    },
  };
}
