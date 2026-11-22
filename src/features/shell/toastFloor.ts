// Where the one toast region floats over the open panel, so a toast never moves the layout
// (ADR-0048 amendment of 2026-11-22). A toast is transient, like a layer the student opens: it
// floats over the plan and nothing makes room for it, so the status row, the timetable, and
// the phone sharing toolbar keep their place while it shows and after it leaves. It must not
// cover the controls along the panel foot, so the plan region names its foot element, the
// status row in edit or the phone sharing toolbar on the export page, and the region floats
// above it, over the bottom of the timetable. The foot is measured at rest by its own size,
// never by the toast's, so a toast that shows or leaves changes nothing the offset reads.
// The scrollers a toast floats over end in a bottom padding about as tall as a toast, present
// at rest, so their last row can always be scrolled clear of one.

import { useEffect, type RefObject } from 'react';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

/** The plan region's padding under its foot element: the p-4 of the grid region and the
 * export page. */
const FOOT_PADDING_PX = 16;

/** The phone bottom nav's height above the bottom safe area inset it pads itself by. */
const BOTTOM_NAV_PX = 56;

/** The gap between the foot element and a toast floating above it. */
const TOAST_GAP_PX = 8;

/**
 * The bottom padding and scroll padding of a scroller a toast floats over, about a toast's
 * height: 60 px holds a toast of one line, 42 px tall, or of two lines where the message
 * wraps, 58 px, and 64 px under a coarse pointer holds the 62 px toast whose controls take
 * the 44 px touch size. It is present at rest, so a toast that shows changes nothing.
 */
export const TOAST_CLEARANCE =
  'pb-15 scroll-pb-15 pointer-coarse:pb-16 pointer-coarse:scroll-pb-16';

const footStore = createStore<{ height: number }>(() => ({ height: 0 }));

function setFootHeight(height: number): void {
  if (footStore.getState().height !== height) {
    footStore.setState({ height });
  }
}

/**
 * Name the element at the panel foot the toast floats above, measured by its own box for as
 * long as it is mounted and `kind` is set. A change of kind measures the new element, since
 * the status row and the sharing toolbar share the one ref.
 */
export function useToastFoot(
  ref: RefObject<HTMLElement | null>,
  kind: string | null,
): void {
  useEffect(() => {
    const node = ref.current;
    if (kind === null || node === null) {
      return undefined;
    }
    const measure = () => {
      setFootHeight(Math.ceil(node.getBoundingClientRect().height));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      observer.disconnect();
      setFootHeight(0);
    };
  }, [ref, kind]);
}

/** The measured height of the foot element, or zero while none is named. */
export function useToastFootHeight(): number {
  return useStore(footStore, (state) => state.height);
}

/**
 * The bottom offset of the toast region over a named foot: the panel padding, the foot, and
 * a gap, plus the bottom nav when it runs under the foot, above the safe area inset that the
 * nav or the panel body pads by.
 */
export function toastBottomOverFoot(
  footHeight: number,
  navShown: boolean,
): string {
  const px =
    FOOT_PADDING_PX +
    footHeight +
    TOAST_GAP_PX +
    (navShown ? BOTTOM_NAV_PX : 0);
  return `calc(${String(px)}px + var(--kcp-safe-bottom))`;
}
