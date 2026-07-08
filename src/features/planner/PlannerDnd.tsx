// The drag context for the planner. Validation runs once on drag start and the
// result drives the grid ghosts, the pulse, and the reason chip. A valid section
// dropped over the planner commits; a blocked drop commits nothing and surfaces
// the reason and its alternatives in the feedback strip. A short pointer
// activation distance keeps a click on a row's own buttons from starting a drag.

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
  type DragStartEvent,
} from '@dnd-kit/core';
import { useStore } from 'zustand';
import type { Course, Section } from '@/lib/domain/types';
import { placedSections } from '@/lib/planner/transaction';
import { planStore } from '@/features/plans/planStore';
import { addSectionToPlan } from '@/features/plans/addToPlan';
import { dragStore } from './dragStore';
import { DragCard } from './DragCard';
import { ReasonChip } from './ReasonChip';

interface DragData {
  course: Course;
  section: Section;
}

function isDragData(value: unknown): value is DragData {
  return (
    typeof value === 'object' &&
    value !== null &&
    'course' in value &&
    'section' in value
  );
}

const ACTIVATION_DISTANCE = 6;

export function PlannerDnd({ children }: { children: ReactNode }) {
  // Only the pointer sensor drags. The grip commits on Enter or Space through its
  // own click handler, so there is no arrow key move machinery to arm, which would
  // be meaningless when every placement is fixed.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: ACTIVATION_DISTANCE },
    }),
  );
  const active = useStore(dragStore, (state) => state.active);

  const handleStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current;
    if (!isDragData(data)) {
      return;
    }
    const placed = placedSections(planStore.getState().entries);
    dragStore.getState().start(data.course, data.section, placed);
  }, []);

  const handleEnd = useCallback((event: DragEndEvent) => {
    const activeDrag = dragStore.getState().active;
    if (activeDrag === null) {
      return;
    }
    if (event.over === null) {
      dragStore.getState().clearActive();
      return;
    }
    if (activeDrag.placement.ok) {
      addSectionToPlan(activeDrag.course, activeDrag.section);
      dragStore.getState().clearActive();
    } else {
      dragStore.getState().reject();
    }
  }, []);

  const handleCancel = useCallback(() => {
    dragStore.getState().clearActive();
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleStart}
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
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
