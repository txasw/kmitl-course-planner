// The export template picker, which is the preview itself (ADR-0045). The selected template
// poster is always centered, full height, and unclipped; the previous and next templates show
// as a constant narrow sliver at each edge, cropped by the frame, dimmed and slightly scaled
// down, so they read as continuation cues rather than comparable options. GalleryPager frames
// the stage with every paging input and the dots; a caption carries the localized name with
// the exact output pixels. The dropdown and the corner size label it replaces are gone.
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
// display option change re-renders the visible poster at once and the slivers lazily. Reduced
// motion drops the settle (via kcp-settle), keeping the switch instant.
//
// A narrow stage, below 900 px wide, renders no slivers and keeps no edge reserve, so the
// poster takes the full width.

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  type RefObject,
} from 'react';
import {
  EXPORT_TEMPLATES,
  templateOutputHeight,
  templateOutputWidth,
  type ExportTemplate,
} from '@/lib/planner/exportTemplates';
import { uiStore } from '@/features/shell/uiStore';
import { useTranslation } from '@/features/shell/useTranslation';
import { useElementSize } from '@/features/shell/useElementSize';
import {
  isNarrowStage,
  isTallStage,
  neighborScale,
  selectedScale,
} from '@/lib/planner/previewStage';
import { GalleryPager } from './GalleryPager';
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
  const narrow = isNarrowStage(area);
  useEffect(() => {
    onStageTallChange(stageTall);
  }, [stageTall, onStageTallChange]);

  const select = useCallback((index: number) => {
    uiStore.getState().setSelectedTemplate(EXPORT_TEMPLATES[index]?.slug ?? '');
  }, []);

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
    <GalleryPager
      viewportRef={viewportRef}
      itemLabels={EXPORT_TEMPLATES.map(templateLabel)}
      caption={templateLabel(selectedTemplate)}
      selected={selectedIndex}
      onSelect={select}
      narrow={narrow}
    >
      {narrow ? null : renderSliver(selectedIndex - 1, 'left')}
      {narrow ? null : renderSliver(selectedIndex + 1, 'right')}
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
    </GalleryPager>
  );
}
