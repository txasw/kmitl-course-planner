// The drag context for the planner. It hosts three gestures. A section drag from the
// catalog validates once on drag start and its result drives the grid ghosts, the
// pulse, and the reason chip; a valid drop commits and a blocked drop surfaces the
// reason and alternatives. A course drag paints every section of the course as a
// candidate slot; dropping on a valid slot commits that section and its pair. A block
// drag lifts a placed section: the remove zone appears at the panel edge and the grid
// paints the subject's other sections as move targets, so a drop removes the section
// or moves it to another slot. A custom collision detection resolves overlapping drop
// targets by an explicit priority, and a short pointer activation distance keeps a
// click on a row or block button from starting a drag.

import type { ReactNode } from 'react';
import { useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useStore } from 'zustand';
import type { Course, Section } from '@/lib/domain/types';
import { placedSections } from '@/lib/planner/transaction';
import { planStore } from '@/features/plans/planStore';
import {
  addSectionToPlan,
  moveSectionInPlan,
  swapSectionInPlan,
} from '@/features/plans/addToPlan';
import { useTranslation } from '@/features/shell/useTranslation';
import { dragStore, blockerIds } from './dragStore';
import { DragCard } from './DragCard';
import { ReasonChip } from './ReasonChip';
import { RemoveZone, REMOVE_ZONE_ID } from './RemoveZone';
import { resolveCourseForSubject } from './resolveCourse';
import { snapDragCardToCursor } from './snapToCursor';
import { prioritizedCollision } from './collision';

interface SectionDragData {
  course: Course;
  section: Section;
}

/** A section drag carries both the course and the section it starts from. */
function isSectionDragData(value: unknown): value is SectionDragData {
  return (
    typeof value === 'object' &&
    value !== null &&
    'course' in value &&
    'section' in value
  );
}

interface CourseDragData {
  course: Course;
}

/** A course drag carries only the course, not a single section. */
function isCourseDragData(value: unknown): value is CourseDragData {
  return (
    typeof value === 'object' &&
    value !== null &&
    'course' in value &&
    !('section' in value)
  );
}

interface BlockDragData {
  block: true;
  teachTableId: string;
}

/** A block drag carries the placed section's id, tagged so it is not a course drag. */
function isBlockDragData(value: unknown): value is BlockDragData {
  return (
    typeof value === 'object' &&
    value !== null &&
    'block' in value &&
    'teachTableId' in value &&
    typeof value.teachTableId === 'string'
  );
}

interface CandidateDropData {
  section: Section;
}

/** A candidate slot drop target carries the section it would place. */
function isCandidateDropData(value: unknown): value is CandidateDropData {
  return (
    typeof value === 'object' &&
    value !== null &&
    'section' in value &&
    !('course' in value) &&
    !('block' in value) &&
    !('swap' in value)
  );
}

interface SwapDropData {
  swap: true;
  blockerTeachTableId: string;
}

/** A swap target drop carries the id of the placed block it would exchange. */
function isSwapDropData(value: unknown): value is SwapDropData {
  return (
    typeof value === 'object' &&
    value !== null &&
    'swap' in value &&
    'blockerTeachTableId' in value &&
    typeof value.blockerTeachTableId === 'string'
  );
}

const ACTIVATION_DISTANCE = 6;

export function PlannerDnd({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const hintText = t('feedback.courseDropHint');
  const moveHint = t('feedback.moveHint');
  const removeLabel = t('blockMove.removeZone');
  // Only the pointer sensor drags. The grip commits on Enter or Space through its
  // own click handler, so there is no arrow key move machinery to arm, which would
  // be meaningless when every placement is fixed.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: ACTIVATION_DISTANCE },
    }),
  );
  const active = useStore(dragStore, (state) => state.active);
  const courseDrag = useStore(dragStore, (state) => state.courseDrag);
  const blockMove = useStore(dragStore, (state) => state.blockMove);

  const handleStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current;
    const placed = placedSections(planStore.getState().entries);
    if (isBlockDragData(data)) {
      const section = placed.find(
        (candidate) => candidate.teachTableId === data.teachTableId,
      );
      if (section === undefined) {
        return;
      }
      const course = resolveCourseForSubject(section.subjectId);
      dragStore.getState().startBlockMove(section, placed, course);
    } else if (isSectionDragData(data)) {
      dragStore.getState().start(data.course, data.section, placed);
    } else if (isCourseDragData(data)) {
      dragStore.getState().startCourse(data.course, placed);
    }
  }, []);

  const handleOver = useCallback((event: DragOverEvent) => {
    const state = dragStore.getState();
    const drag = state.courseDrag ?? state.blockMove;
    if (drag === null) {
      // A section drag keeps the swap context it latched at drag start.
      return;
    }
    const data = event.over?.data.current;
    if (isCandidateDropData(data)) {
      const candidate = drag.candidates.find(
        (item) => item.section.teachTableId === data.section.teachTableId,
      );
      state.setRaised(data.section.teachTableId);
      const course =
        state.courseDrag?.course ?? state.blockMove?.course ?? null;
      if (
        candidate &&
        !candidate.valid &&
        candidate.conflicts.length > 0 &&
        course !== null
      ) {
        // Hovering a blocked candidate latches its blockers as swap targets.
        state.setSwapContext({
          incoming: candidate.section,
          course,
          originId: state.blockMove?.section.teachTableId ?? null,
          blockers: blockerIds(candidate.conflicts),
        });
      } else {
        state.setSwapContext(null);
      }
    } else if (isSwapDropData(data)) {
      // Keep the latched swap context while the pointer is over a swap target.
    } else {
      state.setRaised(null);
    }
  }, []);

  const handleEnd = useCallback(
    (event: DragEndEvent) => {
      const state = dragStore.getState();
      const overData = event.over?.data.current;
      // A drop precisely on a swap target exchanges the blocker for the incoming
      // section. It resolves before the per gesture branches because a swap can end
      // a section, course, or block drag.
      if (isSwapDropData(overData) && state.swapContext !== null) {
        const swap = state.swapContext;
        const removeIds =
          swap.originId === null
            ? [overData.blockerTeachTableId]
            : [overData.blockerTeachTableId, swap.originId];
        const outcome = swapSectionInPlan(
          removeIds,
          swap.course,
          swap.incoming,
        );
        state.clearActive();
        state.clearCourse();
        state.clearBlockMove();
        if (!outcome.ok) {
          // Removing the blocker left the incoming section conflicting elsewhere.
          state.showBlocked({
            course: swap.course,
            section: swap.incoming,
            conflicts: outcome.conflicts,
          });
        }
        return;
      }
      if (state.active !== null) {
        if (event.over === null) {
          state.clearActive();
        } else if (state.active.placement.ok) {
          addSectionToPlan(state.active.course, state.active.section);
          state.clearActive();
        } else {
          state.reject();
        }
        return;
      }
      if (state.blockMove !== null) {
        const move = state.blockMove;
        if (event.over?.id === REMOVE_ZONE_ID) {
          planStore.getState().remove(move.section.teachTableId);
        } else if (isCandidateDropData(overData) && move.course !== null) {
          moveSectionInPlan(
            move.section.teachTableId,
            move.course,
            overData.section,
          );
        } else {
          state.setHint(moveHint);
        }
        state.clearBlockMove();
        return;
      }
      if (state.courseDrag !== null) {
        if (isCandidateDropData(overData)) {
          addSectionToPlan(state.courseDrag.course, overData.section);
        } else {
          state.setHint(hintText);
        }
        state.clearCourse();
      }
    },
    [hintText, moveHint],
  );

  const handleCancel = useCallback(() => {
    dragStore.getState().clearActive();
    dragStore.getState().clearCourse();
    dragStore.getState().clearBlockMove();
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={prioritizedCollision}
      onDragStart={handleStart}
      onDragOver={handleOver}
      onDragEnd={handleEnd}
      onDragCancel={handleCancel}
    >
      {children}
      {blockMove !== null ? <RemoveZone label={removeLabel} /> : null}
      <DragOverlay dropAnimation={null} modifiers={[snapDragCardToCursor]}>
        {active !== null ? (
          <div className="flex flex-col items-start gap-1">
            <DragCard section={active.section} />
            {active.placement.ok ? null : <ReasonChip active={active} />}
          </div>
        ) : blockMove !== null ? (
          <DragCard section={blockMove.section} />
        ) : courseDrag !== null ? (
          <div className="inline-flex items-center gap-1.5 rounded-kcp bg-ink px-2 py-1 text-xs font-medium text-surface shadow-kcp">
            {courseDrag.course.subjectId}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
