// The scaling stage of the export template gallery (ADR-0045): the selected poster alone,
// centered, full height, and unclipped. The named template chips above the stage pick the
// template, so no neighbouring template peeks at the stage edges; a peek cropped by the frame
// showed its text cut mid word, which the owner's rule against cut text forbids (ADR-0045
// amendment of 2026-11-21). The stage math lives in lib/planner/previewStage, which caps the
// display scale at two.
//
// Framing: the scaled wrapper around the selected poster, not the poster itself, carries the
// border and the shadow, so the frame reads on screen while the capture node stays the bare
// poster and the export carries no frame.
//
// Rendering discipline: only the selected poster renders, and it holds the capture ref, so a
// display option change re-renders the visible poster at once. Reduced motion drops the settle
// (via kcp-settle), keeping the switch instant.

import type { RefObject } from 'react';
import type { ExportTemplate } from '@/lib/planner/exportTemplates';
import type { ElementSize } from '@/features/shell/useElementSize';
import { selectedScale } from '@/lib/planner/previewStage';
import { PreviewPoster, type PosterData } from './PreviewPoster';

interface GalleryStageProps {
  poster: PosterData;
  /** The capture node ref, attached to the selected poster. */
  posterRef: RefObject<HTMLDivElement | null>;
  template: ExportTemplate;
  /** The measured stage viewport. */
  area: ElementSize;
}

export function GalleryStage({
  poster,
  posterRef,
  template,
  area,
}: GalleryStageProps) {
  const scale = selectedScale(template, area);

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div
        key={template.slug}
        data-poster-frame
        className="kcp-settle overflow-hidden rounded-kcp bg-surface shadow-kcp ring-1 ring-border"
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
            {...poster}
            template={template}
            posterRef={posterRef}
          />
        </div>
      </div>
    </div>
  );
}
