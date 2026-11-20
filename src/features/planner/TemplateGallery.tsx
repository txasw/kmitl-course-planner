// The export template picker and its preview (ADR-0045). GalleryStage shows the selected
// template poster centered and unclipped with its neighbors as dimmed slivers at the edges;
// GalleryPager heads that stage with the named template chips, each with its exact output
// pixels, and binds the swipe and wheel paging to it. The dropdown and the corner size label
// of the first picker are gone, and so are the dots, arrow rails, and caption the chips
// replaced (ADR-0045 amendment of 2026-11-21).
//
// The gallery measures the stage viewport and reports whether it is taller than wide, so the
// panel can open a tall stage on the portrait phone wallpaper when the student has not chosen
// a template; the resolved template comes back as a prop and drives the selection, the
// toolbar, and every export. A narrow stage, below 900 px wide, renders no slivers and keeps no
// edge reserve, so the poster takes the full width.

import { useCallback, useEffect, useRef, type RefObject } from 'react';
import {
  EXPORT_TEMPLATES,
  type ExportTemplate,
} from '@/lib/planner/exportTemplates';
import { uiStore } from '@/features/shell/uiStore';
import { useElementSize } from '@/features/shell/useElementSize';
import { isNarrowStage, isTallStage } from '@/lib/planner/previewStage';
import { GalleryPager } from './GalleryPager';
import { GalleryStage } from './GalleryStage';
import type { PosterData } from './PreviewPoster';

interface TemplateGalleryProps {
  poster: PosterData;
  /** The capture node ref, attached to the selected poster for the export actions. */
  posterRef: RefObject<HTMLDivElement | null>;
  /** The template on show, resolved by the panel from the choice and the stage shape. */
  template: ExportTemplate;
  /** Reports whether the measured stage is taller than wide. */
  onStageTallChange: (tall: boolean) => void;
}

export function TemplateGallery({
  poster,
  posterRef,
  template: selectedTemplate,
  onStageTallChange,
}: TemplateGalleryProps) {
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

  return (
    <GalleryPager
      viewportRef={viewportRef}
      templates={EXPORT_TEMPLATES}
      selected={selectedIndex}
      onSelect={select}
    >
      <GalleryStage
        poster={poster}
        posterRef={posterRef}
        template={selectedTemplate}
        index={selectedIndex}
        area={area}
        narrow={narrow}
      />
    </GalleryPager>
  );
}
