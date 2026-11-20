// How the one toast region and an open bottom sheet share the panel foot. The toast region
// stays on its own layer above the panel, so a toast over an open sheet is never dimmed by
// the scrim and keeps its single polite live region. A sheet is a modal surface that owns
// the panel foot while it is open, so it makes room for the toast rather than the toast
// covering it: while a toast shows, the sheet ends in a band the toast sits in, below the
// sheet's body and footer. While a sheet is open the region drops to the panel foot, since
// the sheet covers the phone bottom nav the region otherwise rises above. The plan region
// makes room the same way: the toast region reports the height of the toast on show, and
// the plan region ends in a band of that height, so its status row, the export page
// caption and dots, and the phone sharing toolbar rise above the toast rather than sit
// under it.

import { useEffect } from 'react';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { planStore } from '@/features/plans/planStore';
import { toastStore } from './toastStore';
import { uiStore } from './uiStore';

/**
 * The band a sheet ends in while a toast shows: a toast of up to 72 px, at the 16 px foot
 * offset the sheet already pads its last content by, plus an 8 px gap above it.
 */
export const SHEET_TOAST_BAND = 'h-20';

const sheetStore = createStore<{ openSheets: number }>(() => ({
  openSheets: 0,
}));

/** Count the calling bottom sheet as open for as long as it stays mounted. */
export function useBottomSheetPresence(): void {
  useEffect(() => {
    sheetStore.setState((state) => ({ openSheets: state.openSheets + 1 }));
    return () => {
      sheetStore.setState((state) => ({
        openSheets: Math.max(0, state.openSheets - 1),
      }));
    };
  }, []);
}

/** Whether a bottom sheet is open over the panel. */
export function useBottomSheetOpen(): boolean {
  return useStore(sheetStore, (state) => state.openSheets > 0);
}

/**
 * Whether the toast region shows a toast in the open panel: an ordinary toast, or the undo
 * toast, which the region shows only while the panel is open.
 */
export function useToastShown(): boolean {
  const toast = useStore(toastStore, (state) => state.toast !== null);
  const undo = useStore(planStore, (state) => state.pendingUndo !== null);
  const isOpen = useStore(uiStore, (state) => state.isOpen);
  return toast || (undo && isOpen);
}

// The height of the toast on show, measured by the toast region, or zero while it shows
// nothing. The plan region reads it to keep its status row clear of the toast.
const toastHeightStore = createStore<{ height: number }>(() => ({
  height: 0,
}));

/** Record the measured height of the toast region, called by the region itself. */
export function setToastHeight(height: number): void {
  if (toastHeightStore.getState().height !== height) {
    toastHeightStore.setState({ height });
  }
}

/** The gap the plan region keeps between its foot content and a toast below it. */
export const TOAST_BAND_GAP_PX = 8;

/**
 * The band the plan region ends in while a toast shows: the toast's measured height and a
 * gap, so the status row and the poster foot rise above the toast rather than sit under
 * it. Zero while no toast shows, so the region keeps its full height at rest.
 */
export function usePlanToastBand(): number {
  const height = useStore(toastHeightStore, (state) => state.height);
  return height > 0 ? height + TOAST_BAND_GAP_PX : 0;
}
