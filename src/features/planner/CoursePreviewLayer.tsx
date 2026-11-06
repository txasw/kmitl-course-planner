// The preview of a hovered course card: where each of its sections would land on the grid,
// drawn before any drag so a student sees the fit without opening the card. It derives the
// candidates from the live plan on every render that changes either input, so a remove, an
// undo or a revalidation reclassifies them at once. Nothing here is a drop target, so every
// footprint is hidden from assistive technology, takes no pointer, registers no droppable,
// and uses the 2 px dotted border that only previews use (ADR-0057). A fit carries its
// section label on an opaque chip, which covers nothing because a fit overlaps no placed
// block; a clash carries only a faint hatch, so the block text under it stays readable; a
// full or closed section is a bare ink soft outline. A drag in flight owns the grid, so the
// layer draws nothing until it ends.

import { useEffect, useMemo } from 'react';
import { useStore } from 'zustand';
import type { DayOfWeek } from '@/lib/parsing/days';
import type { GridWindow } from '@/lib/planner/grid';
import { candidateFootprints } from '@/lib/planner/candidateLayout';
import {
  courseCandidates,
  type Candidate,
} from '@/lib/planner/courseCandidates';
import { usePlacedSections } from '@/features/plans/planStore';
import { searchStore } from '@/features/search/searchStore';
import { useTranslation } from '@/features/shell/useTranslation';
import { dragStore, selectDragging } from './dragStore';
import { blockStyle, stackOffsetStyle, type Orientation } from './gridGeometry';

type PreviewKind = 'fit' | 'clash' | 'unavailable';

function previewKind(candidate: Candidate): PreviewKind {
  if (candidate.valid) return 'fit';
  return candidate.reason === 'full' || candidate.reason === 'closed'
    ? 'unavailable'
    : 'clash';
}

const BORDER: Record<PreviewKind, string> = {
  fit: 'border-success',
  clash: 'border-danger',
  unavailable: 'border-ink-soft',
};

interface CoursePreviewLayerProps {
  window: GridWindow;
  days: readonly DayOfWeek[];
  orientation: Orientation;
}

export function CoursePreviewLayer({
  window,
  days,
  orientation,
}: CoursePreviewLayerProps) {
  const { t } = useTranslation();
  const hoverCourse = useStore(dragStore, (state) => state.hoverCourse);
  const dragging = useStore(dragStore, selectDragging);
  const placed = usePlacedSections();

  // A new result replaces the courses the cards hold, so a preview of the old one would
  // linger under a resting pointer; the card that is still hovered sets it again.
  useEffect(
    () =>
      searchStore.subscribe((state, previous) => {
        if (state.result !== previous.result) {
          dragStore.getState().clearHoverCourse();
        }
      }),
    [],
  );

  const footprints = useMemo(
    () =>
      hoverCourse === null
        ? []
        : candidateFootprints(courseCandidates(hoverCourse, placed), window),
    [hoverCourse, placed, window],
  );

  if (dragging) return null;

  return (
    <>
      {footprints.map((footprint) => {
        const { candidate, meeting } = footprint;
        const kind = previewKind(candidate);
        return (
          <div
            key={`preview-${candidate.section.teachTableId}-${String(meeting.day)}-${String(meeting.startMin)}`}
            aria-hidden
            data-preview={kind}
            className={`pointer-events-none relative z-grid m-px overflow-hidden rounded-kcp border-2 border-dotted ${BORDER[kind]}`}
            style={{
              ...blockStyle(meeting, window, days, orientation),
              ...stackOffsetStyle(footprint.stack),
            }}
          >
            {kind === 'clash' ? (
              <span className="kcp-hatch absolute inset-0 opacity-50" />
            ) : null}
            {kind === 'fit' ? (
              <span className="m-0.5 inline-block max-w-full truncate rounded-kcp bg-surface px-1 text-2xs font-semibold text-success">
                {t('section.code')} {candidate.section.section}
              </span>
            ) : null}
          </div>
        );
      })}
    </>
  );
}
