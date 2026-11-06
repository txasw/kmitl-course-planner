// The touch input model of ADR-0058, in one place. A mouse drag starts once the pointer
// travels a short distance, so a click on a row or block button is never a drag. A touch
// drag starts once a finger is held still for a quarter second, so a swipe that starts on
// a drag surface stays a scroll: a finger that moves past the tolerance inside the delay
// belongs to the browser.

/** Distance a mouse travels with the button down before a drag starts. */
export const MOUSE_ACTIVATION_DISTANCE_PX = 6;

/** Time a finger is held still before a touch drag starts. */
export const TOUCH_ACTIVATION_DELAY_MS = 250;

/** Distance a held finger may drift inside the delay before the press becomes a scroll. */
export const TOUCH_TOLERANCE_PX = 8;

/** Time a finger is held before the surface reads as pressed, ahead of the drag. */
export const PRESS_FEEDBACK_MS = 120;

/** Length of the vibration that marks a touch drag starting, where one is offered. */
export const DRAG_START_VIBRATION_MS = 10;

/** Mark a touch drag starting with a short vibration. A browser without the vibration
 * API, such as Safari, skips it. */
export function vibrateOnDragStart(): void {
  if ('vibrate' in navigator) {
    navigator.vibrate(DRAG_START_VIBRATION_MS);
  }
}
