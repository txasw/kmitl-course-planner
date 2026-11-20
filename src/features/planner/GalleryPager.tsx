// The paging frame of the export template gallery (ADR-0045): the named template chips above
// the stage, a pointer swipe on the stage viewport, and a vertical or horizontal scroll wheel
// over it (one notch one page). The chips are a radiogroup for direct choice, which also takes
// the arrow keys, Home, and End. Paging clamps at the first and last template rather than
// wrapping. The gallery owns the viewport ref, because it measures the stage; the pager
// renders the viewport and binds its input there.
//
// The chips replace the earlier dot row, the arrow rails beside the stage, and the caption
// under it (ADR-0045 amendment of 2026-11-21): each chip names its template with the exact
// output pixels, so a student picks by name rather than paging blind, and the stage takes the
// full width the rails held.

import {
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import type { ExportTemplate } from '@/lib/planner/exportTemplates';
import { usePager } from '@/components/Pager';
import { TemplateChips } from './TemplateChips';

interface GalleryPagerProps {
  /** The stage viewport, measured by the gallery; the pager renders it and binds its input. */
  viewportRef: RefObject<HTMLDivElement | null>;
  /** The templates, one chip and one page each. */
  templates: readonly ExportTemplate[];
  selected: number;
  onSelect: (index: number) => void;
  /** The stage content the viewport frames. */
  children: ReactNode;
}

const SWIPE_THRESHOLD_PX = 48;
const WHEEL_THRESHOLD_PX = 6;
const WHEEL_COOLDOWN_MS = 320; // one wheel notch is one page

export function GalleryPager({
  viewportRef,
  templates,
  selected,
  onSelect,
  children,
}: GalleryPagerProps) {
  const last = templates.length - 1;
  const swipe = useRef<{ pointerId: number; startX: number } | null>(null);

  const { move, groupRef, handleKeyDown } = usePager({
    count: templates.length,
    selected,
    onSelect,
  });

  // A wheel over the gallery pages horizontally: a vertical notch or a horizontal trackpad
  // swipe, whichever delta dominates. A cooldown keeps one notch to one page. The listener is
  // native and non-passive so it can prevent the page from scrolling; it reads the latest move
  // through a ref so it need not re-bind on every selection.
  const moveRef = useRef(move);
  useEffect(() => {
    moveRef.current = move;
  }, [move]);
  useEffect(() => {
    const node = viewportRef.current;
    if (node === null) {
      return undefined;
    }
    let locked = false;
    const onWheel = (event: WheelEvent) => {
      const delta =
        Math.abs(event.deltaX) >= Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY;
      if (Math.abs(delta) < WHEEL_THRESHOLD_PX) {
        return;
      }
      event.preventDefault();
      if (locked) {
        return;
      }
      locked = true;
      setTimeout(() => {
        locked = false;
      }, WHEEL_COOLDOWN_MS);
      moveRef.current(delta > 0 ? 1 : -1);
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      node.removeEventListener('wheel', onWheel);
    };
  }, [viewportRef]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    swipe.current = { pointerId: event.pointerId, startX: event.clientX };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = swipe.current;
    if (current === null) {
      return;
    }
    if (event.pointerId !== current.pointerId) {
      return;
    }
    swipe.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const dx = event.clientX - current.startX;
    if (dx <= -SWIPE_THRESHOLD_PX) {
      onSelect(Math.min(last, selected + 1));
    } else if (dx >= SWIPE_THRESHOLD_PX) {
      onSelect(Math.max(0, selected - 1));
    }
  };

  return (
    <div data-gallery-pager="" className="flex min-h-0 flex-1 flex-col gap-2">
      <TemplateChips
        templates={templates}
        selected={selected}
        onSelect={onSelect}
        groupRef={groupRef}
        onKeyDown={handleKeyDown}
      />
      <div
        ref={viewportRef}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative min-h-0 flex-1 touch-pan-y select-none overflow-hidden rounded-kcp bg-surface-alt"
      >
        {children}
      </div>
    </div>
  );
}
