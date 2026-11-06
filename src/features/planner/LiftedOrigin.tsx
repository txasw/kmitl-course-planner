// The lifted origin of a block drag (ADR-0059). Each meeting of the dragged section and
// its pair keeps its block in place at 40 percent, and this outline draws a 1 px dashed
// ink soft border over it, so the student sees where the block came from. The origin is a
// drop target of its own: putting the block back ends the drag silently, with no change
// and no missed drop hint. Dashed marks a target; the dotted border is reserved for the
// hover previews, which take no drop. The id carries the origin prefix so the collision
// priority ranks it below a candidate that shares its cell and above the panel.

import type { CSSProperties } from 'react';
import { useDroppable } from '@dnd-kit/core';

export const ORIGIN_ID_PREFIX = 'origin-';

/** Whether a drop target id names a lifted origin. */
export function isOriginId(id: string | number | undefined): boolean {
  return typeof id === 'string' && id.startsWith(ORIGIN_ID_PREFIX);
}

interface LiftedOriginProps {
  id: string;
  style: CSSProperties;
}

export function LiftedOrigin({ id, style }: LiftedOriginProps) {
  const { setNodeRef } = useDroppable({ id, data: { role: 'origin' } });
  return (
    <div
      ref={setNodeRef}
      data-lifted-origin
      aria-hidden
      className="pointer-events-none z-grid m-px rounded-kcp border border-dashed border-ink-soft"
      style={style}
    />
  );
}
