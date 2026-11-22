// How the one toast region and an open bottom sheet share the panel foot. The toast region
// stays on its own layer above the panel, so a toast over an open sheet is never dimmed by
// the scrim and keeps its single polite live region. A toast never moves the layout
// (ADR-0048 amendment of 2026-11-22), and a sheet makes no room for one either: it keeps the
// same box while a toast shows. Instead its body ends at rest in a bottom padding and scroll
// padding as tall as a toast, so the toast floats over that padding and the last item of the
// body can always be scrolled clear of it. A sheet with a footer of actions names the footer,
// measured by its own box, and the region floats above it, so a toast covers none of the
// sheet's actions; a sheet without one leaves the region at the foot over the padding. While a
// sheet is open the region drops to the panel foot, since the sheet covers the phone bottom
// nav and the plan foot the region otherwise rises above.

import { useEffect, type RefObject } from 'react';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

/** The gap between a sheet footer and a toast floating above it. */
const SHEET_TOAST_GAP_PX = 8;

/**
 * The bottom padding and scroll padding a sheet body keeps at rest for a toast floating over
 * its foot. Above a footer it holds the 8 px gap over the footer, a toast up to the 64 px the
 * plan scrollers hold, and a gap; without a footer the toast rests at the 16 px foot offset or
 * the bottom safe area inset, so the padding holds that offset, the toast, and the gap.
 */
export const SHEET_TOAST_ROOM = {
  footer: 'pb-20 scroll-pb-20',
  foot: 'pb-[calc(max(16px,var(--kcp-safe-bottom))+72px)] scroll-pb-[calc(max(16px,var(--kcp-safe-bottom))+72px)]',
} as const;

const sheetStore = createStore<{ openSheets: number; footHeight: number }>(
  () => ({ openSheets: 0, footHeight: 0 }),
);

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
 * Name the footer of an open sheet the toast floats above, measured by its own box for as long
 * as it is mounted and `shown` is set. The footer pads itself clear of the bottom safe area
 * inset, so its height is its whole rise from the foot of the sheet.
 */
export function useSheetToastFoot(
  ref: RefObject<HTMLElement | null>,
  shown: boolean,
): void {
  useEffect(() => {
    const node = ref.current;
    if (!shown || node === null) {
      return undefined;
    }
    const measure = () => {
      const height = Math.ceil(node.getBoundingClientRect().height);
      if (sheetStore.getState().footHeight !== height) {
        sheetStore.setState({ footHeight: height });
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      observer.disconnect();
      sheetStore.setState({ footHeight: 0 });
    };
  }, [ref, shown]);
}

/**
 * The bottom offset of the toast region while it floats above the footer of an open sheet, as
 * a CSS length, or null while no open sheet names a footer.
 */
export function useToastOverSheetFoot(): string | null {
  const open = useBottomSheetOpen();
  const height = useStore(sheetStore, (state) => state.footHeight);
  return open && height > 0 ? `${String(height + SHEET_TOAST_GAP_PX)}px` : null;
}
