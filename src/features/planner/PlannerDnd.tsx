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
} from '@/features/plans/addToPlan';
import { useTranslation } from '@/features/shell/useTranslation';
import { dragStore } from './dragStore';
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
    !('block' in value)
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
    if (state.courseDrag === null && state.blockMove === null) {
      return;
    }
    const data = event.over?.data.current;
    state.setRaised(
      isCandidateDropData(data) ? data.section.teachTableId : null,
    );
  }, []);

  const handleEnd = useCallback(
    (event: DragEndEvent) => {
      const state = dragStore.getState();
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
        const data = event.over?.data.current;
        if (event.over?.id === REMOVE_ZONE_ID) {
          planStore.getState().remove(move.section.teachTableId);
        } else if (isCandidateDropData(data) && move.course !== null) {
          moveSectionInPlan(
            move.section.teachTableId,
            move.course,
            data.section,
          );
        } else {
          state.setHint(moveHint);
        }
        state.clearBlockMove();
        return;
      }
      if (state.courseDrag !== null) {
        const data = event.over?.data.current;
        if (isCandidateDropData(data)) {
          addSectionToPlan(state.courseDrag.course, data.section);
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
