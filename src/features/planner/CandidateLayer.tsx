// The edit mode drag feedback drawn over the day lanes: the footprint ghosts of an active
// section drag, the shaking ghosts of a rejected drop, the candidate slots of a course drag
// or a block move, the preview of a hovered course card, the hover preview of a catalog
// row, the lifted origin of a block move, and the swap targets over the blockers of a
// blocked drag. The ghosts and previews
// take precedence in that order, so a real drag always owns the grid and a preview never
// paints under one. The origin paints before the candidates, so a candidate that shares a
// cell with it draws over it. It is distinct from the dnd-kit drag overlay, which renders
// only the grab card that follows the pointer.
// Every item places at its fixed meeting position, so nothing here moves during a drag.
// Renders a fragment so every item is a direct child of the grid and places by track index.

import { useEffect, type AnimationEvent } from 'react';
import { useStore } from 'zustand';
import type { DayOfWeek } from '@/lib/parsing/days';
import type { Translate } from '@/lib/i18n/t';
import { fillTemplate } from '@/lib/i18n/template';
import type { GridWindow } from '@/lib/planner/grid';
import { candidateFootprints } from '@/lib/planner/candidateLayout';
import type { Candidate } from '@/lib/planner/courseCandidates';
import { dragStore } from './dragStore';
import { CandidateSlot } from './CandidateSlot';
import { SwapTarget } from './SwapTarget';
import { CoursePreviewLayer } from './CoursePreviewLayer';
import { LiftedOrigin, ORIGIN_ID_PREFIX } from './LiftedOrigin';
import type { PlacedSection } from './placedSection';
import {
  blockStyle,
  onShownDay,
  stackOffsetStyle,
  type Orientation,
} from './gridGeometry';

interface CandidateLayerProps {
  sections: PlacedSection[];
  window: GridWindow;
  days: readonly DayOfWeek[];
  orientation: Orientation;
  t: Translate;
}

export function CandidateLayer({
  sections,
  window,
  days,
  orientation,
  t,
}: CandidateLayerProps) {
  const active = useStore(dragStore, (state) => state.active);
  const rejecting = useStore(dragStore, (state) => state.rejecting);
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
  // The rejected footprint draws only the meetings on the shown days. One with none there,
  // an unscheduled section or a day view showing another day, releases at once, so no
  // ghost mounts and shakes later when the student turns to that day.
  const rejectedGhostCount =
    rejecting?.group.reduce(
      (count, groupSection) =>
        count +
        groupSection.meetings.filter((meeting) => onShownDay(meeting, days))
          .length,
      0,
    ) ?? 0;
  useEffect(() => {
    if (rejecting !== null && rejectedGhostCount === 0) {
      dragStore.getState().clearRejecting();
    }
  }, [rejecting, rejectedGhostCount]);
  // Every rejected ghost runs the same animation, so the first to end releases them all.
  // An animation bubbling from a child is not the ghost's own and is ignored.
  const handleShakeEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      dragStore.getState().clearRejecting();
    }
  };
  // A valid block move candidate names the move it performs; every other slot shows its
  // section code, so an add and a move never read alike.
  const candidateLabel = (candidate: Candidate): string =>
    blockMove !== null && candidate.valid
      ? fillTemplate(t('dropZone.move'), { section: candidate.section.section })
      : candidate.section.section;

  return (
    <>
      {active !== null
        ? active.group.flatMap((groupSection) =>
            groupSection.meetings
              .filter((meeting) => onShownDay(meeting, days))
              .map((meeting) => (
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

      {rejecting !== null
        ? rejecting.group.flatMap((groupSection) =>
            groupSection.meetings
              .filter((meeting) => onShownDay(meeting, days))
              .map((meeting) => (
                <div
                  key={`rejected-${groupSection.teachTableId}-${String(meeting.day)}-${String(meeting.startMin)}`}
                  aria-hidden
                  data-ghost="rejected"
                  className="kcp-shake kcp-hatch pointer-events-none m-px rounded-kcp border border-danger bg-danger-soft"
                  style={blockStyle(meeting, window, days, orientation)}
                  onAnimationEnd={handleShakeEnd}
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
        ? hover.meetings
            .filter((meeting) => onShownDay(meeting, days))
            .map((meeting) => (
              <div
                key={`hover-${String(meeting.day)}-${String(meeting.startMin)}`}
                aria-hidden
                data-ghost="hover"
                className="pointer-events-none m-px rounded-kcp border border-dotted border-ink-soft"
                style={blockStyle(meeting, window, days, orientation)}
              />
            ))
        : null}

      {blockMove !== null
        ? blockMove.group.flatMap((groupSection) =>
            groupSection.meetings
              .filter((meeting) => onShownDay(meeting, days))
              .map((meeting) => {
                const id = `${ORIGIN_ID_PREFIX}${groupSection.teachTableId}-${String(meeting.day)}-${String(meeting.startMin)}`;
                return (
                  <LiftedOrigin
                    key={id}
                    id={id}
                    style={blockStyle(meeting, window, days, orientation)}
                  />
                );
              }),
          )
        : null}

      {candidates !== null
        ? candidateFootprints(candidates, window)
            .filter((footprint) => onShownDay(footprint.meeting, days))
            .map((footprint) => {
              const id = `cand-${footprint.candidate.section.teachTableId}-${String(footprint.meeting.day)}-${String(footprint.meeting.startMin)}`;
              return (
                <CandidateSlot
                  key={id}
                  id={id}
                  candidate={footprint.candidate}
                  raised={footprint.candidate.section.teachTableId === raised}
                  label={candidateLabel(footprint.candidate)}
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
              section.meetings
                .filter((meeting) => onShownDay(meeting, days))
                .map((meeting) => {
                  const id = `swap-${section.teachTableId}-${String(meeting.day)}-${String(meeting.startMin)}`;
                  return (
                    <SwapTarget
                      key={id}
                      id={id}
                      blockerTeachTableId={section.teachTableId}
                      label={fillTemplate(t('dropZone.swap'), {
                        section: swapContext.incoming.section,
                      })}
                      style={blockStyle(meeting, window, days, orientation)}
                    />
                  );
                }),
            )
        : null}
    </>
  );
}
