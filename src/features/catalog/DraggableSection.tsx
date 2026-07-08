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
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
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
      className={`flex items-stretch gap-1 ${isDragging ? 'opacity-50' : ''}`}
      onMouseEnter={preview}
      onMouseLeave={clearPreview}
    >
      <button
        type="button"
        aria-label={label}
        onClick={onActivate}
        onFocus={preview}
        onBlur={clearPreview}
        className="flex shrink-0 items-center rounded-kcp px-0.5 text-ink-soft outline-none hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} strokeWidth={2} aria-hidden />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
