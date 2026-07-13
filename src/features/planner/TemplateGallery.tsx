// The export template picker, which is the preview itself (ADR-0045). The selected template
// poster renders centered with the adjacent templates peeking at both edges as a continuation
// cue; a pointer swipe and the arrow keys page between them, a dot radiogroup below allows
// direct jumps, and a caption carries the localized name with the exact output pixels. The
// dropdown and the corner size label it replaces are gone.
//
// Rendering discipline: only the selected poster renders eagerly and holds the capture ref;
// the immediate neighbors render from a deferred copy of the plan data, and the rest of the
// track is empty placeholders, so a display option change re-renders the visible poster at
// once and the neighbors lazily. Paging clamps at the first and last template rather than
// wrapping. Reduced motion swaps the slide for an instant switch.

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from 'react';
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
import { usePrefersReducedMotion } from '@/features/shell/usePresence';
import { Tooltip } from '@/components/Tooltip';
import { FOCUS_RING } from '@/lib/ui/focus';
import { PreviewPoster, type PosterData } from './PreviewPoster';

interface TemplateGalleryProps {
  poster: PosterData;
  /** The capture node ref, attached to the selected poster for the export actions. */
  posterRef: RefObject<HTMLDivElement | null>;
}

// The centered poster fills this fraction of the width, leaving the remainder for the two
// peeking neighbors. A swipe past this pixel distance commits a page.
const SLOT_FRACTION = 0.72;
const POSTER_FIT = 0.94;
const SWIPE_THRESHOLD_PX = 48;

function clampIndex(index: number): number {
  return Math.max(0, Math.min(EXPORT_TEMPLATES.length - 1, index));
}

function posterScale(
  template: ExportTemplate,
  slotWidth: number,
  height: number,
): number {
  if (slotWidth <= 0 || height <= 0) {
    return 0.1;
  }
  return Math.min(
    (slotWidth * POSTER_FIT) / template.layoutWidth,
    (height * POSTER_FIT) / template.layoutHeight,
    1,
  );
}

export function TemplateGallery({ poster, posterRef }: TemplateGalleryProps) {
  const { t } = useTranslation();
  const selectedSlug = useStore(uiStore, (state) => state.selectedTemplate);
  const reducedMotion = usePrefersReducedMotion();

  const selectedIndex = (() => {
    const found = EXPORT_TEMPLATES.findIndex(
      (template) => template.slug === selectedSlug,
    );
    return found === -1 ? 0 : found;
  })();

  const viewportRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ width: 0, height: 0 });
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ pointerId: number; startX: number } | null>(null);

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
          move(EXPORT_TEMPLATES.length - 1 - selectedIndex);
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
    drag.current = { pointerId: event.pointerId, startX: event.clientX };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (current === null) {
      return;
    }
    if (event.pointerId !== current.pointerId) {
      return;
    }
    if (!reducedMotion) {
      setDragOffset(event.clientX - current.startX);
    }
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (current === null) {
      return;
    }
    if (event.pointerId !== current.pointerId) {
      return;
    }
    const dx = event.clientX - current.startX;
    drag.current = null;
    setDragging(false);
    setDragOffset(0);
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (dx <= -SWIPE_THRESHOLD_PX) {
      select(selectedIndex + 1);
    } else if (dx >= SWIPE_THRESHOLD_PX) {
      select(selectedIndex - 1);
    }
  };

  const slotWidth = area.width * SLOT_FRACTION;
  const trackX =
    area.width / 2 - selectedIndex * slotWidth - slotWidth / 2 + dragOffset;
  const selectedTemplate = templateBySlug(selectedSlug);
  const deferredPoster = useDeferredValue(poster);

  const caption = `${t(selectedTemplate.labelKey)} · ${String(
    templateOutputWidth(selectedTemplate),
  )} × ${String(templateOutputHeight(selectedTemplate))}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div
        ref={viewportRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="relative min-h-0 flex-1 touch-pan-y select-none overflow-hidden"
      >
        <div
          className="absolute inset-y-0 left-0 flex"
          style={{
            transform: `translateX(${String(Math.round(trackX))}px)`,
            transition:
              reducedMotion || dragging ? 'none' : 'transform 300ms ease',
            willChange: 'transform',
          }}
        >
          {EXPORT_TEMPLATES.map((template, index) => {
            const isSelected = index === selectedIndex;
            const isNeighbor = Math.abs(index - selectedIndex) === 1;
            const scale = posterScale(template, slotWidth, area.height);
            return (
              <div
                key={template.slug}
                style={{ width: slotWidth }}
                className="flex h-full flex-none items-center justify-center"
              >
                {isSelected || isNeighbor ? (
                  <div
                    aria-hidden={isSelected ? undefined : true}
                    className={
                      isSelected ? '' : 'pointer-events-none opacity-60'
                    }
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
                      <PreviewPoster
                        {...(isSelected ? poster : deferredPoster)}
                        template={template}
                        {...(isSelected ? { posterRef } : {})}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
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
