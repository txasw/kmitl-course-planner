// The paging frame of the export template gallery (ADR-0045): the left and right arrow
// buttons around the stage viewport, a pointer swipe on the viewport, a vertical or horizontal
// scroll wheel over it (one notch one page), the caption, and the dot radiogroup below for
// direct jumps, which also takes the arrow keys, Home, and End. Paging clamps at the first and
// last page rather than wrapping. The gallery owns the viewport ref, because it measures the
// stage; the pager renders the viewport and binds its input there.
//
// On a narrow stage the dots grow to the 44 px touch size, since swipe and dots are then the
// main paging controls; the arrows, keys, and wheel are unchanged.

import {
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from '@/features/shell/useTranslation';
import { PagerArrow, PagerDots, usePager } from '@/components/Pager';
import { TARGET_SIZE, TARGET_TOUCH } from '@/lib/ui/target';

interface GalleryPagerProps {
  /** The stage viewport, measured by the gallery; the pager renders it and binds its input. */
  viewportRef: RefObject<HTMLDivElement | null>;
  /** The accessible name of each page, one per template, already localized. */
  itemLabels: readonly string[];
  /** The caption under the stage, already localized. */
  caption: string;
  selected: number;
  onSelect: (index: number) => void;
  /** Whether the stage is narrow, which grows the dots to the touch size. */
  narrow: boolean;
  /** The stage content the viewport frames. */
  children: ReactNode;
}

const SWIPE_THRESHOLD_PX = 48;
const WHEEL_THRESHOLD_PX = 6;
const WHEEL_COOLDOWN_MS = 320; // one wheel notch is one page

export function GalleryPager({
  viewportRef,
  itemLabels,
  caption,
  selected,
  onSelect,
  narrow,
  children,
}: GalleryPagerProps) {
  const { t } = useTranslation();
  const last = itemLabels.length - 1;
  const swipe = useRef<{ pointerId: number; startX: number } | null>(null);

  const { move, groupRef, handleKeyDown } = usePager({
    count: itemLabels.length,
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
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex min-h-0 flex-1 items-stretch gap-1">
        <PagerArrow
          label={t('preview.gallery.prev')}
          disabled={selected === 0}
          onActivate={() => {
            move(-1);
          }}
        >
          <ChevronLeft size={18} strokeWidth={2} aria-hidden />
        </PagerArrow>

        <div
          ref={viewportRef}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="relative min-h-0 flex-1 touch-pan-y select-none overflow-hidden rounded-kcp bg-surface-alt"
        >
          {children}
        </div>

        <PagerArrow
          label={t('preview.gallery.next')}
          disabled={selected === last}
          onActivate={() => {
            move(1);
          }}
        >
          <ChevronRight size={18} strokeWidth={2} aria-hidden />
        </PagerArrow>
      </div>

      <p className="text-center text-xs text-ink-soft">{caption}</p>

      <PagerDots
        groupRef={groupRef}
        onKeyDown={handleKeyDown}
        label={t('preview.template.label')}
        itemLabels={itemLabels}
        selected={selected}
        onSelect={onSelect}
        targetClassName={narrow ? TARGET_TOUCH : TARGET_SIZE}
      />
    </div>
  );
}
