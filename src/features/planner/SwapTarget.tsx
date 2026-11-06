// A swap target overlaid on a blocking placed block during a blocked drag. Dropping
// precisely here exchanges the blocker for the incoming section rather than doing
// nothing, so a conflict is a guided trade instead of a dead end. It is the swap role of
// the drop zone vocabulary (ADR-0059): a solid KMITL orange border, the exchange icon,
// and a label naming the section the drop brings in, so the role reads without relying
// on colour, distinct from the danger blocked cells. The id carries the swap prefix so
// the collision priority resolves a drop here over the panel, and the data names the
// blocker to remove.

import type { CSSProperties } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { ArrowLeftRight } from 'lucide-react';

interface SwapTargetProps {
  id: string;
  blockerTeachTableId: string;
  style: CSSProperties;
  /** What the drop does, naming the incoming section, such as Swap for section 902. */
  label: string;
}

export function SwapTarget({
  id,
  blockerTeachTableId,
  style,
  label,
}: SwapTargetProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { swap: true, blockerTeachTableId },
  });
  return (
    <div
      ref={setNodeRef}
      data-swap-target={isOver ? 'over' : 'latent'}
      aria-hidden
      className={`pointer-events-none z-grid-active m-px flex items-center justify-center gap-1 overflow-hidden rounded-kcp border-2 border-primary px-1 text-[10px] leading-tight font-semibold text-primary-strong ${
        isOver ? 'bg-primary-soft' : 'bg-surface'
      }`}
      style={style}
    >
      <ArrowLeftRight size={11} className="shrink-0" aria-hidden />
      <span className="line-clamp-2 min-w-0 break-words">{label}</span>
    </div>
  );
}
