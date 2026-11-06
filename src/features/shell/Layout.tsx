import { useLayoutEffect, useRef } from 'react';
import { useStore } from 'zustand';
import { PlannerPanel } from '@/features/planner/PlannerPanel';
import { PlannerDnd } from '@/features/planner/PlannerDnd';
import { PlannerDropZone } from '@/features/planner/PlannerDropZone';
import { RemoveBar } from '@/features/planner/RemoveZone';
import { planStore } from '@/features/plans/planStore';
import { isDockedTier } from '@/lib/ui/breakpoints';
import { BottomNav } from './BottomNav';
import { CatalogColumn, SheetScrim } from './CatalogColumn';
import { EdgeRail } from './EdgeRail';
import { useMobilePane } from './mobilePane';
import { StatusAnnouncer } from './StatusAnnouncer';
import { uiStore } from './uiStore';
import { useCatalogFocusRepair } from './useCatalogFocusRepair';
import { useLayoutTier } from './useLayoutTier';

// The panel body: the catalog column, with the search form at its head, and the
// dominant grid. ADR-0048 removes the search rail at every width. The catalog column
// mounts once and docks beside the grid from the lg tier; on the medium tier the column
// is a slide over sheet toggled from the header, with a scrim over the grid while it is
// open. The open sheet is modal over the grid: the grid region under the scrim is
// inert, and the scrim is a pointer target only, not a tab stop, because the sheet
// header close carries the same action. The sheet open state lives in the ui store. On
// the docked tiers the edge rail follows the column in the tree and takes its place
// while it is hidden. The grid region hosts the weekly timetable, which renders from
// the plan snapshots.
// Below 640 px the body is a stack of panes over a bottom nav. The catalog column and the
// grid region share one grid cell, so both keep the same box, and the pane not shown is
// invisible and inert rather than unmounted or set to display none: its scroll offset,
// its search state and its drag registration wait for its return. Every element keeps
// its place in the tree at every tier, so a tier change never remounts the catalog. The
// pane is settled from the plan the first time the compact tier lays out, before paint.
// The status announcer sits beside the column and outside the inert grid region, so it
// outlives every state the column swaps and still speaks a search outcome while the
// sheet is open or closed, the docked column is hidden, or another pane is shown. Preview
// has no search, so it carries no announcer and no nav. During a block drag the remove
// zone is the docked column, which the column renders itself, or else the bar along the
// body's bottom edge.
export function Layout() {
  const tier = useLayoutTier();
  const viewMode = useStore(uiStore, (state) => state.viewMode);
  const sheetOpen = useStore(uiStore, (state) => state.sheetOpen);
  const pane = useMobilePane();
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const compact = tier === 'compact';
  const sheetModal = tier === 'medium' && sheetOpen;
  const gridHidden = compact && pane === 'catalog';

  // Settled before the focus repair below runs, so a repair into the compact tier finds
  // the nav item of the pane on screen.
  useLayoutEffect(() => {
    if (compact) {
      uiStore
        .getState()
        .settleMobilePane(planStore.getState().entries.length > 0);
    }
  }, [compact]);
  useCatalogFocusRepair(bodyRef, tier);

  // Preview collapses the catalog column out of the DOM and gives the
  // timetable the full panel width as a poster composition.
  if (viewMode === 'preview') {
    return (
      <div className="h-full p-4">
        <PlannerPanel />
      </div>
    );
  }

  return (
    <PlannerDnd>
      <div
        ref={bodyRef}
        className={
          compact
            ? 'relative grid h-full grid-cols-1 grid-rows-[minmax(0,1fr)_auto]'
            : 'relative flex h-full'
        }
      >
        <StatusAnnouncer />
        <CatalogColumn tier={tier} />
        {isDockedTier(tier) ? <EdgeRail /> : null}

        <div
          inert={sheetModal || gridHidden || undefined}
          aria-hidden={gridHidden || undefined}
          className={`min-w-0 overflow-hidden p-4 ${
            compact
              ? `col-start-1 row-start-1 min-h-0 ${gridHidden ? 'invisible' : ''}`
              : 'flex-1'
          }`}
        >
          <PlannerDropZone>
            <PlannerPanel />
          </PlannerDropZone>
        </div>

        <SheetScrim tier={tier} />
        <RemoveBar tier={tier} />
        {compact ? <BottomNav /> : null}
      </div>
    </PlannerDnd>
  );
}
