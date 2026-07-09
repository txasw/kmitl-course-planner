// A swap target overlaid on a blocking placed block during a blocked drag. Dropping
// precisely here exchanges the blocker for the incoming section rather than doing
// nothing, so a conflict is a guided trade instead of a dead end. The KMITL orange
// marks it as the interactive affordance, distinct from the danger blocked cells. The
// id carries the swap prefix so the collision priority resolves a drop here over the
// panel, and the data names the blocker to remove.

import type { CSSProperties } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Repeat } from 'lucide-react';

interface SwapTargetProps {
  id: string;
  blockerTeachTableId: string;
  style: CSSProperties;
  /** The short code of the incoming section, shown as what the drop places here. */
  incomingLabel: string;
  /** The accessible action label, for example "Swap". */
  actionLabel: string;
}

export function SwapTarget({
  id,
  blockerTeachTableId,
  style,
  incomingLabel,
  actionLabel,
}: SwapTargetProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { swap: true, blockerTeachTableId },
  });
  return (
    <div
      ref={setNodeRef}
      data-swap-target
      aria-hidden
      title={`${actionLabel} ${incomingLabel}`}
      className={`pointer-events-none z-30 m-px flex items-center justify-center gap-1 overflow-hidden rounded-kcp border-2 border-dashed border-primary px-1 text-[10px] font-semibold text-primary ${
        isOver ? 'bg-primary-soft' : 'bg-surface/85'
      }`}
      style={style}
    >
      <Repeat size={11} aria-hidden />
      <span className="truncate">{incomingLabel}</span>
    </div>
  );
}
