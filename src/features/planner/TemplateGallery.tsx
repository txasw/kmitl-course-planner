// The export template picker, which is the preview itself (ADR-0045). The selected template
// poster is always centered, full height, and unclipped; the previous and next templates show
// as a constant narrow sliver at each edge, cropped by the frame, dimmed and slightly scaled
// down, so they read as continuation cues rather than comparable options. Paging: the left and
// right arrow buttons, a pointer swipe, the arrow keys, a vertical or horizontal scroll wheel
// (one notch one page), and the dot radiogroup below for direct jumps, with Home and End. A
// caption carries the localized name with the exact output pixels. The dropdown and the corner
// size label it replaces are gone.
//
// Rendering discipline: only the selected poster renders eagerly and holds the capture ref; the
// two slivers render from a deferred copy of the plan data, and no other template renders, so a
// display option change re-renders the visible poster at once and the slivers lazily. Paging
// clamps at the first and last template rather than wrapping. Reduced motion drops the settle
// (via kcp-settle), keeping the switch instant.

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from 'zustand';
import {
  EXPORT_TEMPLATES,
  templateBySlug,
  templateOutputHeight,
  templateOutputWidth,
  type ExportTemplate,
} from '@/lib/planner/exportTemplates';
import { uiStore } from '@/features/shell/uiStore';
import { useTranslation } from '@/features/shell/useTranslation';
import { Tooltip } from '@/components/Tooltip';
import { FOCUS_RING } from '@/lib/ui/focus';
import { PreviewPoster, type PosterData } from './PreviewPoster';

interface TemplateGalleryProps {
  poster: PosterData;
  /** The capture node ref, attached to the selected poster for the export actions. */
  posterRef: RefObject<HTMLDivElement | null>;
}

const SLIVER_PX = 44; // the visible width of a neighbor at each edge
const EDGE_RESERVE_PX = 60; // width each edge keeps clear so the selection never touches a sliver
const NEIGHBOR_HEIGHT_SCALE = 0.9; // a neighbor sits a touch shorter than the selection
const NEIGHBOR_OPACITY = 0.4; // and dimmed, so it reads as a cue not an option
const POSTER_FIT = 0.94;
const SWIPE_THRESHOLD_PX = 48;
const WHEEL_THRESHOLD_PX = 6;
const WHEEL_COOLDOWN_MS = 320; // one wheel notch is one page

const LAST_INDEX = EXPORT_TEMPLATES.length - 1;

function clampIndex(index: number): number {
  return Math.max(0, Math.min(LAST_INDEX, index));
}

// The scale that centers the selected poster full height and unclipped, within the width left
// after reserving a sliver zone at each edge.
function selectedScale(
  template: ExportTemplate,
  width: number,
  height: number,
): number {
  const usableWidth = width - 2 * EDGE_RESERVE_PX;
  if (usableWidth <= 0 || height <= 0) {
    return 0.1;
  }
  return Math.min(
    usableWidth / template.layoutWidth,
    (height * POSTER_FIT) / template.layoutHeight,
    1,
  );
}

// A neighbor is scaled to a slightly shorter height; only its sliver shows, so width is free.
function neighborScale(template: ExportTemplate, height: number): number {
  if (height <= 0) {
    return 0.1;
  }
  return Math.min(
    (height * POSTER_FIT * NEIGHBOR_HEIGHT_SCALE) / template.layoutHeight,
    1,
  );
}

function PagerArrow({
  label,
  disabled,
  onActivate,
  children,
}: {
  label: string;
  disabled: boolean;
  onActivate: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip label={label}>
      {(triggerProps, ref) => (
        <button
          ref={ref}
          {...triggerProps}
          type="button"
          aria-label={label}
          disabled={disabled}
          onClick={onActivate}
          className={`flex shrink-0 items-center justify-center rounded-kcp border border-border p-1 text-ink-soft transition-colors hover:bg-surface-alt disabled:pointer-events-none disabled:opacity-30 ${FOCUS_RING}`}
        >
          {children}
        </button>
      )}
    </Tooltip>
  );
}

export function TemplateGallery({ poster, posterRef }: TemplateGalleryProps) {
  const { t } = useTranslation();
  const selectedSlug = useStore(uiStore, (state) => state.selectedTemplate);

  const selectedIndex = (() => {
    const found = EXPORT_TEMPLATES.findIndex(
      (template) => template.slug === selectedSlug,
    );
    return found === -1 ? 0 : found;
  })();

  const viewportRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ width: 0, height: 0 });
  const swipe = useRef<{ pointerId: number; startX: number } | null>(null);

  useEffect(() => {
    const node = viewportRef.current;
    if (node === null) {
      return undefined;
    }
    const measure = () => {
      setArea({ width: node.clientWidth, height: node.clientHeight });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, []);

  const select = useCallback((index: number) => {
    uiStore
      .getState()
      .setSelectedTemplate(EXPORT_TEMPLATES[clampIndex(index)]?.slug ?? '');
  }, []);

  const focusDot = useCallback((index: number) => {
    const dots =
      groupRef.current?.querySelectorAll<HTMLElement>('[role="radio"]');
    dots?.[index]?.focus();
  }, []);

  const move = useCallback(
    (delta: number) => {
      const next = clampIndex(selectedIndex + delta);
      if (next !== selectedIndex) {
        select(next);
      }
      focusDot(next);
    },
    [selectedIndex, select, focusDot],
  );

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
  }, []);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          event.preventDefault();
          move(1);
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          event.preventDefault();
          move(-1);
          break;
        case 'Home':
          event.preventDefault();
          move(-selectedIndex);
          break;
        case 'End':
          event.preventDefault();
          move(LAST_INDEX - selectedIndex);
          break;
        default:
          break;
      }
    },
    [move, selectedIndex],
  );

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
      select(selectedIndex + 1);
    } else if (dx >= SWIPE_THRESHOLD_PX) {
      select(selectedIndex - 1);
    }
  };

  const selectedTemplate = templateBySlug(selectedSlug);
  const deferredPoster = useDeferredValue(poster);
  const selScale = selectedScale(selectedTemplate, area.width, area.height);

  const caption = `${t(selectedTemplate.labelKey)} · ${String(
    templateOutputWidth(selectedTemplate),
  )} × ${String(templateOutputHeight(selectedTemplate))}`;

  const renderSliver = (index: number, side: 'left' | 'right') => {
    const template = EXPORT_TEMPLATES[index];
    if (template === undefined) {
      return null;
    }
    const scale = neighborScale(template, area.height);
    return (
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 overflow-hidden ${
          side === 'left' ? 'left-0' : 'right-0'
        }`}
        style={{ width: SLIVER_PX, opacity: NEIGHBOR_OPACITY }}
      >
        <div
          className={`absolute top-1/2 -translate-y-1/2 ${
            side === 'left' ? 'right-0' : 'left-0'
          }`}
          style={{
            width: template.layoutWidth * scale,
            height: template.layoutHeight * scale,
          }}
        >
          <div
            style={{
              width: template.layoutWidth,
              height: template.layoutHeight,
              transform: `scale(${String(scale)})`,
              transformOrigin: 'top left',
            }}
          >
            <PreviewPoster {...deferredPoster} template={template} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex min-h-0 flex-1 items-stretch gap-1">
        <PagerArrow
          label={t('preview.gallery.prev')}
          disabled={selectedIndex === 0}
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
          className="relative min-h-0 flex-1 touch-pan-y select-none overflow-hidden"
        >
          {renderSliver(selectedIndex - 1, 'left')}
          {renderSliver(selectedIndex + 1, 'right')}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              key={selectedTemplate.slug}
              className="kcp-settle"
              style={{
                width: selectedTemplate.layoutWidth * selScale,
                height: selectedTemplate.layoutHeight * selScale,
              }}
            >
              <div
                style={{
                  width: selectedTemplate.layoutWidth,
                  height: selectedTemplate.layoutHeight,
                  transform: `scale(${String(selScale)})`,
                  transformOrigin: 'top left',
                }}
              >
                <PreviewPoster
                  {...poster}
                  template={selectedTemplate}
                  posterRef={posterRef}
                />
              </div>
            </div>
          </div>
        </div>

        <PagerArrow
          label={t('preview.gallery.next')}
          disabled={selectedIndex === LAST_INDEX}
          onActivate={() => {
            move(1);
          }}
        >
          <ChevronRight size={18} strokeWidth={2} aria-hidden />
        </PagerArrow>
      </div>

      <p className="text-center text-xs font-medium text-ink-soft">{caption}</p>

      <div
        ref={groupRef}
        role="radiogroup"
        aria-label={t('preview.template.label')}
        className="flex items-center justify-center gap-2.5"
      >
        {EXPORT_TEMPLATES.map((template, index) => {
          const isSelected = index === selectedIndex;
          const label = `${t(template.labelKey)} · ${String(
            templateOutputWidth(template),
          )} × ${String(templateOutputHeight(template))}`;
          return (
            <Tooltip key={template.slug} label={label}>
              {(triggerProps, ref) => (
                <button
                  ref={ref}
                  {...triggerProps}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={label}
                  tabIndex={isSelected ? 0 : -1}
                  onKeyDown={handleKeyDown}
                  onClick={() => {
                    select(index);
                  }}
                  className={`h-2.5 w-2.5 rounded-full border transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary'
                      : 'border-border bg-transparent hover:border-ink-soft'
                  } ${FOCUS_RING}`}
                />
              )}
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
