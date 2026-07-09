// Collision detection for the planner. dnd-kit's pointerWithin resolves overlapping
// drop targets purely by geometry, so a swap target under a candidate slot in the
// same cell would win or lose by corner distance, which flips with the candidate
// stack offset. This wraps pointerWithin and reorders the hits by an explicit target
// priority so a drop always resolves to the same target the user sees: the remove
// zone first, then a candidate slot, then a swap target, then the whole panel. The
// priority reads the target id prefix, which the droppables set, so the ordering
// needs no access to dnd-kit's loosely typed collision data.

import { pointerWithin, type CollisionDetection } from '@dnd-kit/core';
import { REMOVE_ZONE_ID } from './RemoveZone';

/** Lower wins. A drop where several targets overlap resolves to the lowest number. */
function priority(id: string | number): number {
  if (id === REMOVE_ZONE_ID) {
    return 0;
  }
  if (typeof id === 'string') {
    if (id.startsWith('cand-')) {
      return 1;
    }
    if (id.startsWith('swap-')) {
      return 2;
    }
  }
  return 3;
}

/**
 * Stable sort the collisions by target priority, so equal priority hits keep the
 * pointerWithin order (nearest first). Exported for the unit test.
 */
export function orderByPriority<T extends { id: string | number }>(
  collisions: T[],
): T[] {
  if (collisions.length <= 1) {
    return collisions;
  }
  return [...collisions].sort((a, b) => priority(a.id) - priority(b.id));
}

export const prioritizedCollision: CollisionDetection = (args) =>
  orderByPriority(pointerWithin(args));
