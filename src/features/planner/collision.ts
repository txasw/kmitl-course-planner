// Collision detection for the planner. dnd-kit's pointerWithin resolves overlapping
// drop targets purely by geometry, so a swap target and the blocked candidate it
// belongs to, which share a cell, would win or lose by corner distance. This wraps
// pointerWithin and reorders the hits by an explicit target priority so a drop always
// resolves to the same target the user sees: the remove zone first, then a swap
// target, then a candidate slot, then the whole panel. Swap ranks above candidate so
// a drop on a blocking block that a blocked candidate overlaps performs the exchange;
// a valid candidate never overlaps a swap target, so this does not affect a plain add
// or move. The priority reads the target id prefix, which the droppables set, so the
// ordering needs no access to dnd-kit's loosely typed collision data.

import { pointerWithin, type CollisionDetection } from '@dnd-kit/core';
import { REMOVE_ZONE_ID } from './RemoveZone';

/** Lower wins. A drop where several targets overlap resolves to the lowest number. */
function priority(id: string | number): number {
  if (id === REMOVE_ZONE_ID) {
    return 0;
  }
  if (typeof id === 'string') {
    if (id.startsWith('swap-')) {
      return 1;
    }
    if (id.startsWith('cand-')) {
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
