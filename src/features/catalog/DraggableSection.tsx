// A drag handle that makes an addable section a drag source. The handle carries
// the course and section as drag data so the planner validates and places them,
// and a short activation distance on the pointer sensor lets a click on the row's
// own add button through while a deliberate drag starts the placement gesture. The
// handle is a focusable button, so the keyboard sensor can pick the section up too.

import type { ReactNode } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { GripVertical } from 'lucide-react';
import type { Course, Section } from '@/lib/domain/types';

interface DraggableSectionProps {
  id: string;
  course: Course;
  section: Section;
  label: string;
  children: ReactNode;
}

export function DraggableSection({
  id,
  course,
  section,
  label,
  children,
}: DraggableSectionProps) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id,
    data: { course, section },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex items-stretch gap-1 ${isDragging ? 'opacity-50' : ''}`}
    >
      <button
        type="button"
        aria-label={label}
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
