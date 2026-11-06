// Controls that sit inside a drag surface, such as the grip, the add rail, or a remove
// button, must not arm the drag around them when pressed. The mouse sensor arms on mouse
// down and the touch sensor on touch start, so a control stops both, and the pointer down
// too, from reaching the surface (ADR-0058).

import type { SyntheticEvent } from 'react';

function stopPropagation(event: SyntheticEvent): void {
  event.stopPropagation();
}

/** Spread on a control inside a drag surface so pressing it never starts a drag. */
export const NO_DRAG_ARMING = {
  onPointerDown: stopPropagation,
  onMouseDown: stopPropagation,
  onTouchStart: stopPropagation,
};
