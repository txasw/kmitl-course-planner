// How the product tour finds the control a step points at and brings it on screen
// (ADR-0074). Controls carry a data-tour attribute; a step takes the first of its targets
// with a control that is shown: in the document, outside every inert subtree, laid out,
// and not hidden by visibility. That rules out the pane a phone is not showing, the
// closed catalog sheet, the hidden docked column, and the sections of a collapsed course.
//
// Before a step looks, the panel shows the view the step lives in through the same store
// writes the entry points use: on a phone the catalog pane or the timetable pane, on the
// medium tier the catalog sheet open or closed, on the docked tiers the catalog column
// shown or the plan on its timetable. The header the export step points at shows in every
// view, so that step changes nothing. A shown control that sits outside the visible part
// of its scroller is scrolled into it, by the scroller inside the panel only, so the host
// page never scrolls.

import {
  tourTargetSelector,
  type TourAnchor,
  type TourStep,
  type TourTarget,
  type TourView,
} from '@/lib/onboarding/tour';
import { isDockedTier, type LayoutTier } from '@/lib/ui/breakpoints';
import { selectNavItem } from '@/features/shell/mobilePane';
import { uiStore } from '@/features/shell/uiStore';

/** Whether a control is on screen for the student, in a browser and in jsdom alike. */
export function isShown(element: HTMLElement): boolean {
  return (
    element.isConnected &&
    element.closest('[inert]') === null &&
    element.getClientRects().length > 0 &&
    window.getComputedStyle(element).visibility !== 'hidden'
  );
}

/** Whether any control in the root carries the target, shown or not. */
export function hasTarget(root: ParentNode, target: TourTarget): boolean {
  return root.querySelector(tourTargetSelector(target)) !== null;
}

export interface ResolvedAnchor {
  anchor: TourAnchor;
  element: HTMLElement;
}

/** The first shown control among the step's targets, in their order of preference. */
export function resolveAnchor(
  root: ParentNode,
  step: TourStep,
): ResolvedAnchor | null {
  for (const anchor of step.anchors) {
    const element = Array.from(
      root.querySelectorAll<HTMLElement>(tourTargetSelector(anchor.target)),
    ).find(isShown);
    if (element !== undefined) return { anchor, element };
  }
  return null;
}

/** Lays the panel out to show the view a step lives in, at the given tier. */
export function showTourView(view: TourView, tier: LayoutTier): void {
  if (view === 'header') return;
  const ui = uiStore.getState();
  if (tier === 'compact') {
    selectNavItem(view === 'catalog' ? 'catalog' : 'timetable');
    return;
  }
  if (view === 'plan') ui.setPlanView('timetable');
  if (isDockedTier(tier)) {
    if (view === 'catalog') ui.setCatalogVisible(true);
    return;
  }
  ui.setSheetOpen(view === 'catalog');
}

function isScroller(element: HTMLElement): boolean {
  const { overflowY } = window.getComputedStyle(element);
  return (
    (overflowY === 'auto' || overflowY === 'scroll') &&
    element.scrollHeight > element.clientHeight
  );
}

/**
 * Scrolls the nearest scroller between the control and the panel so the control lies
 * inside its visible part, the least distance needed. It moves at once, with no smooth
 * scroll, so a reduced motion setting sees no movement either.
 */
export function revealWithin(element: HTMLElement, panel: HTMLElement): void {
  let node = element.parentElement;
  while (node !== null && node !== panel) {
    if (isScroller(node)) {
      const view = node.getBoundingClientRect();
      const box = element.getBoundingClientRect();
      if (box.top < view.top) {
        node.scrollTop -= view.top - box.top;
      } else if (box.bottom > view.bottom) {
        node.scrollTop += Math.min(
          box.bottom - view.bottom,
          box.top - view.top,
        );
      }
      return;
    }
    node = node.parentElement;
  }
}
