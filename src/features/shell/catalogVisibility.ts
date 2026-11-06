// The one way the catalog column is shown or hidden, recorded in ADR-0048. Each
// control that toggles the column calls a funnel here rather than the store, so the
// guards hold for every path. Nothing toggles while any drag is in flight, because the
// grid width is frozen for the length of a drag. A click past the first of a multi click
// is ignored, and so is a pointer activation that follows the previous pointer toggle
// within a short window, because the hide control and the edge rail share one point on
// screen and a quick second click would undo the first. A keyboard activation, whose
// detail is 0, is never throttled. The window is a module scoped timestamp, not store
// state, so it never renders anything. Every close of the sheet, on the tiers below the
// dock, goes through one funnel here too, so focus always lands on the header toggle.
//
// The funnels also slide the docked column in and out through the Web Animations API,
// after the visibility change has committed. The effects move the column by transform
// only and fade a separate shadow child by opacity, so both stay on the compositor while
// the main thread re-lays out the grid once at its new width. A leaving column keeps its
// visibility through the slide by a third effect, then drops to the hidden state its
// classes already hold. Every effect fills none, so when one ends or is cancelled the
// column is exactly what its classes say and nothing can stick. No store state and no
// animationend listener is involved, so a slide never renders and never replays.

import { dragStore, selectDragging } from '@/features/planner/dragStore';
import { commitAndFocus } from './commitAndFocus';
import { uiStore } from './uiStore';
import { REDUCED_MOTION_QUERY } from './usePresence';

/** Id of the catalog column, the target of every control that shows or hides it. */
export const CATALOG_COLUMN_ID = 'kcp-catalog-column';

/** Id of the docked column hide control, which takes focus when the column returns. */
export const CATALOG_HIDE_ID = 'kcp-catalog-hide';

/** Id of the header catalog toggle, the sheet control on the tiers below the dock. */
export const CATALOG_TOGGLE_ID = 'kcp-catalog-toggle';

/** Id of the edge rail, which takes the column's place and focus when it is hidden. */
export const CATALOG_RAIL_ID = 'kcp-catalog-rail';

/** The window after a pointer toggle in which another pointer toggle is ignored. */
export const POINTER_TOGGLE_GUARD_MS = 200;

/** The child of the docked column that carries the drawer shadow during a slide. */
const SHADOW_SELECTOR = '[data-catalog-shadow]';

/** The id every slide effect carries, so only the slide's own effects are touched. */
const SLIDE_EFFECT_ID = 'kcp-catalog-slide';

const OFF_EDGE = 'translateX(-100%)';

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

/**
 * Reads a motion duration token from an element's computed style in milliseconds. It
 * takes the seconds form too, since the build minifier may shorten 200ms to .2s. An
 * empty or unreadable token reads as 0, which means no motion, so the slide never runs
 * on a hardcoded copy of a token.
 */
export function readMotionToken(element: Element, name: string): number {
  const value = getComputedStyle(element).getPropertyValue(name).trim();
  const match = /^(\d*\.?\d+)(ms|s)$/.exec(value);
  if (match === null) return 0;
  const amount = Number(match[1]);
  return match[2] === 's' ? amount * 1000 : amount;
}

function slideEffects(column: Element): Animation[] {
  const shadow = column.querySelector(SHADOW_SELECTOR);
  return [column, shadow].flatMap((element) =>
    element === null
      ? []
      : element
          .getAnimations()
          .filter((effect) => effect.id === SLIDE_EFFECT_ID),
  );
}

/**
 * Slides the docked column in from, or out to, the panel's leading edge. A running slide
 * is cancelled first, so a quick show then hide restarts from the committed state. Under
 * reduced motion, or when a token cannot be read, the change stays instant.
 */
export function slideCatalog(column: Element, direction: 'in' | 'out'): void {
  for (const effect of slideEffects(column)) effect.cancel();
  if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return;

  const entering = direction === 'in';
  const duration = readMotionToken(
    column,
    entering ? '--kcp-duration-base' : '--kcp-duration-fast',
  );
  const easing = getComputedStyle(column)
    .getPropertyValue(entering ? '--kcp-ease-enter' : '--kcp-ease-exit')
    .trim();
  if (duration === 0 || easing === '') return;

  const timing: KeyframeAnimationOptions = {
    duration,
    easing,
    fill: 'none',
    id: SLIDE_EFFECT_ID,
  };
  column.animate(
    { transform: entering ? [OFF_EDGE, 'none'] : ['none', OFF_EDGE] },
    timing,
  );
  if (!entering) {
    column.animate({ visibility: ['visible', 'hidden'] }, timing);
  }
  column
    .querySelector(SHADOW_SELECTOR)
    ?.animate({ opacity: entering ? [1, 0] : [0, 1] }, timing);
}

/**
 * Jumps a running slide to its end, so a caller that measures the column, such as a
 * drag start registering drop zones, reads its final position.
 */
export function finishCatalogSlide(root: Document | ShadowRoot): void {
  const column = root.getElementById(CATALOG_COLUMN_ID);
  if (column === null) return;
  for (const effect of slideEffects(column)) effect.finish();
}

function columnOf(control: Element): HTMLElement | null {
  const root = control.getRootNode();
  return root instanceof Document || root instanceof ShadowRoot
    ? root.getElementById(CATALOG_COLUMN_ID)
    : null;
}

/** The rail attribute that holds its peek off until the pointer first moves off it. */
const PEEK_HELD_ATTRIBUTE = 'data-peek-held';

/**
 * Holds the rail's peek off after a pointer hide, which mounts the rail under the
 * pointer; otherwise the hint would slide out as the column slides away. The hold ends
 * at the first pointer move that lands outside the rail. A pointerleave on the rail
 * cannot end it, because the rail mounted under a still pointer and Chromium sends no
 * enter or leave to an element the pointer has not moved over. The attribute is set on
 * the element rather than declared in the rail's markup, so a render never resets it.
 */
function holdPeek(rail: HTMLElement): void {
  rail.setAttribute(PEEK_HELD_ATTRIBUTE, '');
  const root = rail.getRootNode();
  const release = (event: Event): void => {
    if (event.composedPath().includes(rail)) return;
    rail.removeAttribute(PEEK_HELD_ATTRIBUTE);
    root.removeEventListener('pointermove', release);
  };
  root.addEventListener('pointermove', release);
}

/** Hide the docked column from its hide control and move focus to the edge rail. */
export function hideCatalog(control: Element, detail: number): void {
  if (!mayToggle(detail)) return;
  const column = columnOf(control);
  const rail = commitAndFocus(control, CATALOG_RAIL_ID, () => {
    uiStore.getState().setCatalogVisible(false);
  });
  if (detail > 0 && rail !== null) holdPeek(rail);
  if (column !== null) slideCatalog(column, 'out');
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
  // The rail unmounts with the change, so the column is found through it beforehand.
  const column = columnOf(control);
  commitAndFocus(control, focusId, () => {
    uiStore.getState().setCatalogVisible(true);
  });
  if (column !== null) slideCatalog(column, 'in');
}

/**
 * Close the catalog sheet from the control that asked for it and move focus to the
 * header toggle, which opens it again.
 */
export function closeSheet(control: Element): void {
  commitAndFocus(control, CATALOG_TOGGLE_ID, () => {
    uiStore.getState().setSheetOpen(false);
  });
}
