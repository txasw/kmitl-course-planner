// The remove drop target, shown only while a placed block is dragged. Dropping a
// block here takes its section and pair out of the plan. It floats at the panel edge
// so it does not resize the grid mid drag, which would shift the candidate slots the
// same drag just painted. Its role tags it for the collision priority so a drop that
// lands on it wins over an overlapping candidate slot.

import { useDroppable } from '@dnd-kit/core';
import { Trash2 } from 'lucide-react';

export const REMOVE_ZONE_ID = 'kcp-remove-zone';

export function RemoveZone({ label }: { label: string }) {
  const { setNodeRef, isOver } = useDroppable({
    id: REMOVE_ZONE_ID,
    data: { role: 'remove' },
  });
  return (
    <div
      ref={setNodeRef}
      className={`pointer-events-none absolute bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-kcp border px-3 py-2 text-xs font-medium shadow-kcp ${
        isOver
          ? 'border-danger bg-danger-soft text-danger'
          : 'border-border bg-surface text-ink-soft'
      }`}
    >
      <Trash2 size={16} aria-hidden />
      <span>{label}</span>
    </div>
  );
}
