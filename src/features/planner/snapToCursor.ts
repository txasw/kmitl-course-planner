// A drag overlay modifier that anchors the grab card's top-left to the pointer, so
// the card follows the cursor rather than floating at the dragged node's origin.
// dnd-kit positions the overlay from the measured node's top-left plus the pointer
// delta, and the section grip stretches to the full row height, so without this the
// card would sit above the pointer by half a row. Anchoring the top-left (not the
// centre) keeps the card at the cursor with the reason chip trailing below it. A touch
// drag anchors the same point, and the overlay content lifts itself above the finger
// with the kcp-grab-lift class, since only the content knows its own size (ADR-0058).
// A second modifier then keeps the measured content inside the window, so near an edge
// the card and the reason chip slide back rather than run past it.

import type { Modifier } from '@dnd-kit/core';

/** Whether a drag was started by a finger. The touch sensor activates from a touch start,
 * which carries its coordinates on the touch list rather than on the event. The type is
 * read rather than tested with instanceof, since a desktop browser without touch support
 * has no TouchEvent constructor. */
export function isTouchEvent(event: Event): event is TouchEvent {
  return event.type.startsWith('touch');
}

/** Read the client coordinates a drag started from, or null when unavailable. The mouse
 * sensor delivers a mouse event that carries clientX and clientY; the touch sensor
 * delivers a touch start whose first touch carries them. */
export function activatorCoordinates(
  event: Event | null,
): { x: number; y: number } | null {
  if (event === null) {
    return null;
  }
  if (isTouchEvent(event)) {
    const touch = event.touches[0] ?? event.changedTouches[0];
    return touch === undefined ? null : { x: touch.clientX, y: touch.clientY };
  }
  if (
    'clientX' in event &&
    'clientY' in event &&
    typeof event.clientX === 'number' &&
    typeof event.clientY === 'number'
  ) {
    return { x: event.clientX, y: event.clientY };
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

/** The room the drag overlay keeps from the window edge, so no line of it is cut. */
export const OVERLAY_EDGE_GAP = 8;

/** The width and height of the drag overlay content. */
export interface OverlaySize {
  width: number;
  height: number;
}

function clampStart(start: number, size: number, end: number): number {
  const max = Math.max(OVERLAY_EDGE_GAP, end - size - OVERLAY_EDGE_GAP);
  return Math.min(Math.max(start, OVERLAY_EDGE_GAP), max);
}

/**
 * Keep the whole drag overlay inside the window. dnd-kit sizes the overlay wrapper to the
 * dragged grip, so the grab card and the reason chip under it overflow that box; the
 * content is measured instead, and near the right or bottom edge the overlay slides back
 * so its every line shows whole (ADR-0048 amendment). Runs after the cursor snap.
 */
export function keepOverlayInWindow(size: OverlaySize | null): Modifier {
  return ({ draggingNodeRect, transform, windowRect }) => {
    if (draggingNodeRect === null || windowRect === null || size === null) {
      return transform;
    }
    const left = draggingNodeRect.left + transform.x;
    const top = draggingNodeRect.top + transform.y;
    return {
      ...transform,
      x: transform.x + clampStart(left, size.width, windowRect.right) - left,
      y: transform.y + clampStart(top, size.height, windowRect.bottom) - top,
    };
  };
}
