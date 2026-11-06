// The edit mode drag feedback drawn over the day lanes: the footprint ghosts of an active
// section drag, the candidate slots of a course drag or a block move, the preview of a
// hovered course card, the hover preview of a catalog row, and the swap targets over the
// blockers of a blocked drag. The ghosts and previews take precedence in that order, so a
// real drag always owns the grid and a preview never paints under one. It is distinct
// from the dnd-kit drag overlay, which renders only the grab card that follows the pointer.
// Every item places at its fixed meeting position, so nothing here moves during a drag.
// Renders a fragment so every item is a direct child of the grid and places by track index.

import { useStore } from 'zustand';
import type { DayOfWeek } from '@/lib/parsing/days';
import type { GridWindow } from '@/lib/planner/grid';
import { candidateFootprints } from '@/lib/planner/candidateLayout';
import { dragStore } from './dragStore';
import { CandidateSlot } from './CandidateSlot';
import { SwapTarget } from './SwapTarget';
import { CoursePreviewLayer } from './CoursePreviewLayer';
import type { PlacedSection } from './placedSection';
import { blockStyle, stackOffsetStyle, type Orientation } from './gridGeometry';

interface CandidateLayerProps {
  sections: PlacedSection[];
  window: GridWindow;
  days: readonly DayOfWeek[];
  orientation: Orientation;
}

export function CandidateLayer({
  sections,
  window,
  days,
  orientation,
}: CandidateLayerProps) {
  const active = useStore(dragStore, (state) => state.active);
  const hover = useStore(dragStore, (state) => state.hover);
  const hoverCourse = useStore(dragStore, (state) => state.hoverCourse);
  const courseDrag = useStore(dragStore, (state) => state.courseDrag);
  const blockMove = useStore(dragStore, (state) => state.blockMove);
  const raised = useStore(dragStore, (state) => state.raised);
  const swapContext = useStore(dragStore, (state) => state.swapContext);
  const swapBlockers =
    swapContext === null ? new Set<string>() : new Set(swapContext.blockers);
  // Candidate slots come from a course drag or a block move, whichever is active.
  const candidates = courseDrag?.candidates ?? blockMove?.candidates ?? null;

  return (
    <>
      {active !== null
        ? active.group.flatMap((groupSection) =>
            groupSection.meetings.map((meeting) => (
              <div
                key={`ghost-${groupSection.teachTableId}-${String(meeting.day)}-${String(meeting.startMin)}`}
                aria-hidden
                data-ghost={active.placement.ok ? 'valid' : 'blocked'}
                className={`pointer-events-none m-px rounded-kcp border ${
                  active.placement.ok
                    ? 'border-success bg-success-soft'
                    : 'kcp-hatch border-danger bg-danger-soft'
                }`}
                style={blockStyle(meeting, window, days, orientation)}
              />
            )),
          )
        : null}

      <CoursePreviewLayer
        window={window}
        days={days}
        orientation={orientation}
      />

      {active === null &&
      candidates === null &&
      hoverCourse === null &&
      hover !== null
        ? hover.meetings.map((meeting) => (
            <div
              key={`hover-${String(meeting.day)}-${String(meeting.startMin)}`}
              aria-hidden
              data-ghost="hover"
              className="pointer-events-none m-px rounded-kcp border border-dotted border-ink-soft"
              style={blockStyle(meeting, window, days, orientation)}
            />
          ))
        : null}

      {candidates !== null
        ? candidateFootprints(candidates, window).map((footprint) => {
            const id = `cand-${footprint.candidate.section.teachTableId}-${String(footprint.meeting.day)}-${String(footprint.meeting.startMin)}`;
            return (
              <CandidateSlot
                key={id}
                id={id}
                candidate={footprint.candidate}
                raised={footprint.candidate.section.teachTableId === raised}
                style={{
                  ...blockStyle(footprint.meeting, window, days, orientation),
                  ...stackOffsetStyle(footprint.stack),
                }}
              />
            );
          })
        : null}

      {swapContext !== null
        ? sections
            .filter((section) => swapBlockers.has(section.teachTableId))
            .flatMap((section) =>
              section.meetings.map((meeting) => {
                const id = `swap-${section.teachTableId}-${String(meeting.day)}-${String(meeting.startMin)}`;
                return (
                  <SwapTarget
                    key={id}
                    id={id}
                    blockerTeachTableId={section.teachTableId}
                    incomingLabel={swapContext.incoming.section}
                    style={blockStyle(meeting, window, days, orientation)}
                  />
                );
              }),
            )
        : null}
    </>
  );
}
