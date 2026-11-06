// A drag handle that makes a section a drag source and a keyboard commit affordance
// in one. Pointer users drag the grip onto the grid; keyboard users focus it, which
// previews the target cells, and press Enter or Space, which commits the section or
// routes to the blocked feedback exactly like the add button, since arrow key
// movement is meaningless when every placement is fixed. Hovering the row with a mouse
// or focusing the grip previews the section's cells at low emphasis; a finger never
// hovers, so a tap does not draw the preview (ADR-0058). A held finger marks the row
// pressed before its drag starts, and the dragged row dims to 40 percent. Where the
// catalog turns drag off, below 640 px, the row is no drag source and shows no grab
// cursor or pressed mark, and the grip stays as the commit control.

import { useEffect, type PointerEvent, type ReactNode } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { GripVertical } from 'lucide-react';
import type { Course, Section } from '@/lib/domain/types';
import { dragStore } from '@/features/planner/dragStore';
import { NO_DRAG_ARMING } from '@/features/planner/dragArming';
import { TARGET_SIZE } from '@/lib/ui/target';
import {
  dragSourceClass,
  useTouchPress,
} from '@/features/planner/useTouchPress';
import { useCatalogDragEnabled } from './catalogDrag';

interface DraggableSectionProps {
  id: string;
  course: Course;
  section: Section;
  label: string;
  onActivate: () => void;
  children: ReactNode;
}

export function DraggableSection({
  id,
  course,
  section,
  label,
  onActivate,
  children,
}: DraggableSectionProps) {
  // The whole row is the pointer drag source now, not only the grip, so a grab anywhere
  // on the row commits the section, the city builder grab feel. The grip stays as the
  // visual hint and the keyboard commit anchor; there is no dnd keyboard sensor, so the
  // draggable attributes are omitted and the grip button carries the keyboard commit.
  const dragEnabled = useCatalogDragEnabled();
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id,
    data: { course, section },
    disabled: !dragEnabled,
  });
  const press = useTouchPress();

  const preview = () => {
    dragStore.getState().setHover(section);
  };
  const clearPreview = () => {
    dragStore.getState().clearHover();
  };
  const handlePointerEnter = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') {
      preview();
    }
  };

  // A row can unmount under a resting pointer, through a collapse, a filter edit or a new
  // result, and then never sees its mouse leave, so it clears its own preview on the way
  // out. Only its own: a preview another row has taken since stays.
  const { teachTableId } = section;
  useEffect(
    () => () => {
      const { hover, clearHover } = dragStore.getState();
      if (hover?.teachTableId === teachTableId) clearHover();
    },
    [teachTableId],
  );

  return (
    <div
      ref={setNodeRef}
      data-drag-surface="section"
      className={`touch-drag flex items-stretch gap-1 rounded-kcp ${
        dragEnabled ? 'cursor-grab' : ''
      } ${dragSourceClass(isDragging, dragEnabled && press.pressed)}`}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={clearPreview}
      {...press.handlers}
      {...listeners}
    >
      <button
        type="button"
        aria-label={label}
        onClick={onActivate}
        onFocus={preview}
        onBlur={clearPreview}
        // Keyboard and click only: a press on the grip must not arm the row drag, so it
        // stays a discrete commit control rather than a second drag source.
        {...NO_DRAG_ARMING}
        className={`flex shrink-0 items-center justify-center rounded-kcp px-0.5 text-ink-soft outline-none hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${TARGET_SIZE}`}
      >
        <GripVertical size={14} strokeWidth={2} aria-hidden />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
