// The scaling stage of the export template gallery (ADR-0045): the selected poster centered,
// full height, and unclipped, with the previous and next templates as a constant narrow sliver
// at each edge, cropped by the frame, dimmed and slightly scaled down, so they read as
// continuation cues rather than comparable options. The stage math lives in
// lib/planner/previewStage, which caps the display scale at two.
//
// Framing: the scaled wrapper around the selected poster, not the poster itself, carries the
// border and the shadow, so the frame reads on screen while the capture node stays the bare
// poster and the export carries no frame.
//
// Rendering discipline: only the selected poster renders eagerly and holds the capture ref; the
// two slivers render from a deferred copy of the plan data, and no other template renders, so a
// display option change re-renders the visible poster at once and the slivers lazily. Reduced
// motion drops the settle (via kcp-settle), keeping the switch instant. A narrow stage renders
// no slivers, so the poster takes the full width.

import { useDeferredValue, type RefObject } from 'react';
import {
  EXPORT_TEMPLATES,
  type ExportTemplate,
} from '@/lib/planner/exportTemplates';
import type { ElementSize } from '@/features/shell/useElementSize';
import { neighborScale, selectedScale } from '@/lib/planner/previewStage';
import { PreviewPoster, type PosterData } from './PreviewPoster';

interface GalleryStageProps {
  poster: PosterData;
  /** The capture node ref, attached to the selected poster. */
  posterRef: RefObject<HTMLDivElement | null>;
  template: ExportTemplate;
  /** The index of the selected template, whose neighbors become the slivers. */
  index: number;
  /** The measured stage viewport. */
  area: ElementSize;
  /** Whether the stage is narrow, which drops the slivers. */
  narrow: boolean;
}

const SLIVER_PX = 44; // the visible width of a neighbor at each edge
const NEIGHBOR_OPACITY = 0.4; // dimmed, so a neighbor reads as a cue not an option

export function GalleryStage({
  poster,
  posterRef,
  template: selectedTemplate,
  index,
  area,
  narrow,
}: GalleryStageProps) {
  const deferredPoster = useDeferredValue(poster);
  const selScale = selectedScale(selectedTemplate, area);

  const renderSliver = (sliverIndex: number, side: 'left' | 'right') => {
    const template = EXPORT_TEMPLATES[sliverIndex];
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
    <>
      {narrow ? null : renderSliver(index - 1, 'left')}
      {narrow ? null : renderSliver(index + 1, 'right')}
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
    </>
  );
}
