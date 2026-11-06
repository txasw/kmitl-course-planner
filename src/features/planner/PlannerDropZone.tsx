// A drop target covering the planner. A valid section dropped anywhere here
// commits, whether the pointer is over the grid or the shelf; the commit and
// reject logic lives in the drag context. Dropping over this zone is what
// distinguishes a placement from a drag released elsewhere, so the commit outline
// draws this zone's edge and reads its over state.

import type { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { CommitZoneOutline } from './CommitZoneOutline';

export const PLANNER_DROP_ID = 'kcp-planner-drop';

export function PlannerDropZone({ children }: { children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: PLANNER_DROP_ID,
    data: { role: 'panel' },
  });
  return (
    <div ref={setNodeRef} className="relative h-full">
      {children}
      <CommitZoneOutline over={isOver} />
    </div>
  );
}
