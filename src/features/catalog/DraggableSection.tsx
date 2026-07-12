// A drag handle that makes a section a drag source and a keyboard commit affordance
// in one. Pointer users drag the grip onto the grid; keyboard users focus it, which
// previews the target cells, and press Enter or Space, which commits the section or
// routes to the blocked feedback exactly like the add button, since arrow key
// movement is meaningless when every placement is fixed. Hovering the row or
// focusing the grip previews the section's cells at low emphasis.

import type { ReactNode } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { GripVertical } from 'lucide-react';
import type { Course, Section } from '@/lib/domain/types';
import { dragStore } from '@/features/planner/dragStore';

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
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id,
    data: { course, section },
  });

  const preview = () => {
    dragStore.getState().setHover(section);
  };
  const clearPreview = () => {
    dragStore.getState().clearHover();
  };

  return (
    <div
      ref={setNodeRef}
      data-drag-surface="section"
      className={`flex touch-none cursor-grab items-stretch gap-1 ${isDragging ? 'opacity-50' : ''}`}
      onMouseEnter={preview}
      onMouseLeave={clearPreview}
      {...listeners}
    >
      <button
        type="button"
        aria-label={label}
        onClick={onActivate}
        onFocus={preview}
        onBlur={clearPreview}
        onPointerDown={(event) => {
          // Keyboard and click only: a press on the grip must not arm the row drag, so it
          // stays a discrete commit control rather than a second drag source.
          event.stopPropagation();
        }}
        className="flex shrink-0 items-center rounded-kcp px-0.5 text-ink-soft outline-none hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <GripVertical size={14} strokeWidth={2} aria-hidden />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
