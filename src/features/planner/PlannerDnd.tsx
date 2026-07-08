// The drag context for the planner. It hosts two gestures. A section drag validates
// once on drag start and its result drives the grid ghosts, the pulse, and the
// reason chip; a valid drop over the planner commits and a blocked drop surfaces the
// reason and alternatives in the strip. A course drag instead paints every section
// of the course as a candidate slot on the grid at once; dropping on a valid slot
// commits that section and its pair, and dropping on empty grid gives one gentle
// hint. A short pointer activation distance keeps a click on a row button from
// starting a drag, and pointer within collision resolves the drop wherever the
// pointer is over the grid.

import type { ReactNode } from 'react';
import { useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
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
import { addSectionToPlan } from '@/features/plans/addToPlan';
import { useTranslation } from '@/features/shell/useTranslation';
import { dragStore } from './dragStore';
import { DragCard } from './DragCard';
import { ReasonChip } from './ReasonChip';

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

interface CandidateDropData {
  section: Section;
}

/** A candidate slot drop target carries the section it would place. */
function isCandidateDropData(value: unknown): value is CandidateDropData {
  return (
    typeof value === 'object' &&
    value !== null &&
    'section' in value &&
    !('course' in value)
  );
}

const ACTIVATION_DISTANCE = 6;

export function PlannerDnd({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const hintText = t('feedback.courseDropHint');
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

  const handleStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current;
    const placed = placedSections(planStore.getState().entries);
    if (isSectionDragData(data)) {
      dragStore.getState().start(data.course, data.section, placed);
    } else if (isCourseDragData(data)) {
      dragStore.getState().startCourse(data.course, placed);
    }
  }, []);

  const handleOver = useCallback((event: DragOverEvent) => {
    if (dragStore.getState().courseDrag === null) {
      return;
    }
    const data = event.over?.data.current;
    dragStore
      .getState()
      .setRaised(isCandidateDropData(data) ? data.section.teachTableId : null);
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
    [hintText],
  );

  const handleCancel = useCallback(() => {
    dragStore.getState().clearActive();
    dragStore.getState().clearCourse();
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleStart}
      onDragOver={handleOver}
      onDragEnd={handleEnd}
      onDragCancel={handleCancel}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {active !== null ? (
          <div className="flex flex-col items-start gap-1">
            <DragCard section={active.section} />
            {active.placement.ok ? null : <ReasonChip active={active} />}
          </div>
        ) : courseDrag !== null ? (
          <div className="inline-flex items-center gap-1.5 rounded-kcp bg-ink px-2 py-1 text-xs font-medium text-surface shadow-kcp">
            {courseDrag.course.subjectId}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
