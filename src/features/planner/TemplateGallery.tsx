// The export template picker, which is the preview itself (ADR-0045). GalleryStage shows the
// selected template poster centered and unclipped with its neighbors as dimmed slivers at the
// edges; GalleryPager frames that stage with every paging input and the dots, and a caption
// carries the localized name with the exact output pixels. The dropdown and the corner size
// label it replaces are gone.
//
// The gallery measures the stage viewport and reports whether it is taller than wide, so the
// panel can open a tall stage on the portrait phone wallpaper when the student has not chosen
// a template; the resolved template comes back as a prop and drives the selection, the
// toolbar, and every export. A narrow stage, below 900 px wide, renders no slivers and keeps no
// edge reserve, so the poster takes the full width, and grows the dots to the touch size.

import { useCallback, useEffect, useRef, type RefObject } from 'react';
import {
  EXPORT_TEMPLATES,
  templateOutputHeight,
  templateOutputWidth,
  type ExportTemplate,
} from '@/lib/planner/exportTemplates';
import { uiStore } from '@/features/shell/uiStore';
import { useTranslation } from '@/features/shell/useTranslation';
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

  const templateLabel = (template: ExportTemplate) =>
    `${t(template.labelKey)} · ${String(
      templateOutputWidth(template),
    )} × ${String(templateOutputHeight(template))}`;

  return (
    <GalleryPager
      viewportRef={viewportRef}
      itemLabels={EXPORT_TEMPLATES.map(templateLabel)}
      caption={templateLabel(selectedTemplate)}
      selected={selectedIndex}
      onSelect={select}
      narrow={narrow}
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
