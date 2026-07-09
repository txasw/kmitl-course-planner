// A drag overlay modifier that anchors the grab card's top-left to the pointer, so
// the card follows the cursor rather than floating at the dragged node's origin.
// dnd-kit positions the overlay from the measured node's top-left plus the pointer
// delta, and the section grip stretches to the full row height, so without this the
// card would sit above the pointer by half a row. Anchoring the top-left (not the
// centre) keeps the card at the cursor with the reason chip trailing below it.

import type { Modifier } from '@dnd-kit/core';

/** Read the client coordinates a drag started from, or null when unavailable. */
export function activatorCoordinates(
  event: Event | null,
): { x: number; y: number } | null {
  if (event === null) {
    return null;
  }
  if ('clientX' in event && 'clientY' in event) {
    const pointer = event as { clientX: number; clientY: number };
    return { x: pointer.clientX, y: pointer.clientY };
  }
  if ('changedTouches' in event) {
    const touch = (event as TouchEvent).changedTouches[0];
    if (touch) {
      return { x: touch.clientX, y: touch.clientY };
    }
  }
  return null;
}

/**
 * Shift the overlay transform so the dragging node's top-left tracks the pointer.
 * With no activator coordinates or node rect yet, the transform passes through
 * unchanged.
 */
export const snapDragCardToCursor: Modifier = ({
  activatorEvent,
  draggingNodeRect,
  transform,
}) => {
  const pointer = activatorCoordinates(activatorEvent);
  if (pointer === null || draggingNodeRect === null) {
    return transform;
  }
  return {
    ...transform,
    x: transform.x + pointer.x - draggingNodeRect.left,
    y: transform.y + pointer.y - draggingNodeRect.top,
  };
};
