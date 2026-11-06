// The one way an entry point outside the panel opens it at a target: the toolbar icon and
// its shortcut, a welcome primary action, and every entry prompt action call this funnel
// rather than the store, so the layout each target needs is written the same way at
// every tier. The layout patch is written before the panel opens, so the first frame of
// the overlay already shows the target and no pane flips after it mounts.
//
// resume     a plain open that keeps the session layout, the same as the launcher
// catalog    the catalog with its search, in edit mode since preview collapses it away
// timetable  the weekly grid, with the catalog sheet closed where it covers the grid
// updates    the timetable in edit mode with the updates dialog over it when it has items
//
// The catalog and updates targets set edit mode, which the preferences persistence saves
// as the last used mode, the same as the pre share notice's review action.

import { planStore } from '@/features/plans/planStore';
import { revalidationStore } from '@/features/plans/revalidationStore';
import { hasUpdateItems } from '@/lib/planner/updateReview';
import {
  BREAKPOINTS,
  isDockedTier,
  minWidthQuery,
  tierForWidth,
  type LayoutTier,
} from '@/lib/ui/breakpoints';
import { selectNavItem } from './mobilePane';
import { uiStore } from './uiStore';

/** Where an entry point opens the panel. */
export type PanelTarget = 'resume' | 'catalog' | 'timetable' | 'updates';

// The tier cuts widest first, the order useLayoutTier checks its media queries in.
const TIER_CUTS = [
  BREAKPOINTS['2xl'],
  BREAKPOINTS.xl,
  BREAKPOINTS.lg,
  BREAKPOINTS.sm,
] as const;

/**
 * The layout tier the panel lays out at right now, read once from the same media queries
 * and boundary table as useLayoutTier, for a caller outside React such as a message
 * handler.
 */
export function currentLayoutTier(): LayoutTier {
  const reached = TIER_CUTS.find(
    (px) => window.matchMedia(minWidthQuery(px)).matches,
  );
  return tierForWidth(reached ?? 0);
}

function showCatalogAt(tier: LayoutTier): void {
  const ui = uiStore.getState();
  ui.setViewMode('edit');
  if (tier === 'compact') {
    selectNavItem('catalog');
  } else if (isDockedTier(tier)) {
    ui.setCatalogVisible(true);
  } else {
    ui.setSheetOpen(true);
  }
}

function showTimetableAt(tier: LayoutTier): void {
  if (tier === 'compact') {
    selectNavItem('timetable');
    return;
  }
  const ui = uiStore.getState();
  ui.setPlanView('timetable');
  if (!isDockedTier(tier)) ui.setSheetOpen(false);
}

/** Open the panel at a target, laid out for the given tier, the current one by default. */
export function openPanelAt(
  target: PanelTarget,
  tier: LayoutTier = currentLayoutTier(),
): void {
  if (target === 'catalog') {
    showCatalogAt(tier);
  } else if (target === 'timetable') {
    showTimetableAt(tier);
  } else if (target === 'updates') {
    uiStore.getState().setViewMode('edit');
    showTimetableAt(tier);
  }
  uiStore.getState().open();
  // The guard keeps the dialog flag from being left open with nothing to list.
  if (target === 'updates' && hasUpdateItems(planStore.getState().entries)) {
    revalidationStore.getState().setUpdatesOpen(true);
  }
}
