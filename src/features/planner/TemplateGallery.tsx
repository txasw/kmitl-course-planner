// The export template picker, which is the preview itself (ADR-0045). The selected template
// poster is always centered, full height, and unclipped; the previous and next templates show
// as a constant narrow sliver at each edge, cropped by the frame, dimmed and slightly scaled
// down, so they read as continuation cues rather than comparable options. Paging: the left and
// right arrow buttons, a pointer swipe, the arrow keys, a vertical or horizontal scroll wheel
// (one notch one page), and the dot radiogroup below for direct jumps, with Home and End. A
// caption carries the localized name with the exact output pixels. The dropdown and the corner
// size label it replaces are gone.
//
// Framing: the stage is a quiet surface-alt field, and the scaled wrapper around the selected
// poster, not the poster itself, carries the border and the shadow, so the frame reads on
// screen while the capture node stays the bare poster and the export carries no frame. The
// stage math lives in lib/planner/previewStage, which caps the display scale at two. The
// gallery reports whether its stage is taller than wide, so the panel can open a tall stage on
// the portrait phone wallpaper when the student has not chosen a template; the resolved
// template comes back as a prop and drives the selection, the toolbar, and every export.
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
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  EXPORT_TEMPLATES,
  templateOutputHeight,
  templateOutputWidth,
  type ExportTemplate,
} from '@/lib/planner/exportTemplates';
import { uiStore } from '@/features/shell/uiStore';
import { useTranslation } from '@/features/shell/useTranslation';
import { useElementSize } from '@/features/shell/useElementSize';
import { PagerArrow, PagerDots, usePager } from '@/components/Pager';
import {
  isTallStage,
  neighborScale,
  selectedScale,
} from '@/lib/planner/previewStage';
import { PreviewPoster, type PosterData } from './PreviewPoster';

interface TemplateGalleryProps {
  poster: PosterData;
  /** The capture node ref, attached to the selected poster for the export actions. */
  posterRef: RefObject<HTMLDivElement | null>;
  /** The template on show, resolved by the panel from the choice and the stage shape. */
  template: ExportTemplate;
  /** Reports whether the measured stage is taller than wide. */
  onStageTallChange: (tall: boolean) => void;
}

const SLIVER_PX = 44; // the visible width of a neighbor at each edge
const NEIGHBOR_OPACITY = 0.4; // dimmed, so a neighbor reads as a cue not an option
const SWIPE_THRESHOLD_PX = 48;
const WHEEL_THRESHOLD_PX = 6;
const WHEEL_COOLDOWN_MS = 320; // one wheel notch is one page

const LAST_INDEX = EXPORT_TEMPLATES.length - 1;

function clampIndex(index: number): number {
  return Math.max(0, Math.min(LAST_INDEX, index));
}

export function TemplateGallery({
  poster,
  posterRef,
  template: selectedTemplate,
  onStageTallChange,
}: TemplateGalleryProps) {
  const { t } = useTranslation();

  const selectedIndex = (() => {
    const found = EXPORT_TEMPLATES.findIndex(
      (template) => template.slug === selectedTemplate.slug,
    );
    return found === -1 ? 0 : found;
  })();

  const viewportRef = useRef<HTMLDivElement>(null);
  const area = useElementSize(viewportRef);
  const stageTall = isTallStage(area);
  useEffect(() => {
    onStageTallChange(stageTall);
  }, [stageTall, onStageTallChange]);
  const swipe = useRef<{ pointerId: number; startX: number } | null>(null);

  const select = useCallback((index: number) => {
    uiStore
      .getState()
      .setSelectedTemplate(EXPORT_TEMPLATES[clampIndex(index)]?.slug ?? '');
  }, []);

  const { move, groupRef, handleKeyDown } = usePager({
    count: EXPORT_TEMPLATES.length,
    selected: selectedIndex,
    onSelect: select,
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
  }, []);

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

  const deferredPoster = useDeferredValue(poster);
  const selScale = selectedScale(selectedTemplate, area);

  const templateLabel = (template: ExportTemplate) =>
    `${t(template.labelKey)} · ${String(
      templateOutputWidth(template),
    )} × ${String(templateOutputHeight(template))}`;

  const renderSliver = (index: number, side: 'left' | 'right') => {
    const template = EXPORT_TEMPLATES[index];
    if (template === undefined) {
      return null;
    }
    const scale = neighborScale(template, area);
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
          className="relative min-h-0 flex-1 touch-pan-y select-none overflow-hidden rounded-kcp bg-surface-alt"
        >
          {renderSliver(selectedIndex - 1, 'left')}
          {renderSliver(selectedIndex + 1, 'right')}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              key={selectedTemplate.slug}
              data-poster-frame
              className="kcp-settle overflow-hidden rounded-kcp bg-surface shadow-kcp ring-1 ring-border"
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

      <p className="text-center text-xs text-ink-soft">
        {templateLabel(selectedTemplate)}
      </p>

      <PagerDots
        groupRef={groupRef}
        onKeyDown={handleKeyDown}
        label={t('preview.template.label')}
        itemLabels={EXPORT_TEMPLATES.map(templateLabel)}
        selected={selectedIndex}
        onSelect={select}
      />
    </div>
  );
}
