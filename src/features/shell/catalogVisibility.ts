// The one way the docked catalog column is shown or hidden, recorded in ADR-0048. Each
// control that toggles the column calls a funnel here rather than the store, so the
// guards hold for every path. Nothing toggles while any drag is in flight, because the
// grid width is frozen for the length of a drag. A click past the first of a multi click
// is ignored, and so is a pointer activation that follows the previous pointer toggle
// within a short window, because the hide control and the edge rail share one point on
// screen and a quick second click would undo the first. A keyboard activation, whose
// detail is 0, is never throttled. The window is a module scoped timestamp, not store
// state, so it never renders anything.

import { dragStore, selectDragging } from '@/features/planner/dragStore';
import { commitAndFocus } from './commitAndFocus';
import { uiStore } from './uiStore';

/** Id of the docked column hide control, which takes focus when the column returns. */
export const CATALOG_HIDE_ID = 'kcp-catalog-hide';

/** Id of the header catalog toggle, the sheet control on the tiers below the dock. */
export const CATALOG_TOGGLE_ID = 'kcp-catalog-toggle';

/** Id of the edge rail, which takes the column's place and focus when it is hidden. */
export const CATALOG_RAIL_ID = 'kcp-catalog-rail';

/** The window after a pointer toggle in which another pointer toggle is ignored. */
export const POINTER_TOGGLE_GUARD_MS = 200;

let lastPointerToggle = Number.NEGATIVE_INFINITY;

/** Whether an activation with this event detail may toggle the column now. */
function mayToggle(detail: number): boolean {
  if (selectDragging(dragStore.getState())) return false;
  if (detail > 1) return false;
  if (detail > 0) {
    const now = performance.now();
    if (now - lastPointerToggle < POINTER_TOGGLE_GUARD_MS) return false;
    lastPointerToggle = now;
  }
  return true;
}

/** Hide the docked column from its hide control and move focus to the edge rail. */
export function hideCatalog(control: Element, detail: number): void {
  if (!mayToggle(detail)) return;
  commitAndFocus(control, CATALOG_RAIL_ID, () => {
    uiStore.getState().setCatalogVisible(false);
  });
}

/**
 * Show the docked column and move focus into it, to the hide control unless the
 * caller names another target, such as a course to reveal.
 */
export function showCatalog(
  control: Element,
  detail: number,
  focusId: string = CATALOG_HIDE_ID,
): void {
  if (!mayToggle(detail)) return;
  commitAndFocus(control, focusId, () => {
    uiStore.getState().setCatalogVisible(true);
  });
}
