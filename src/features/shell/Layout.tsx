import { useRef } from 'react';
import { useStore } from 'zustand';
import { PlannerPanel } from '@/features/planner/PlannerPanel';
import { PlannerDnd } from '@/features/planner/PlannerDnd';
import { PlannerDropZone } from '@/features/planner/PlannerDropZone';
import { RemoveBar } from '@/features/planner/RemoveZone';
import { isDockedTier } from '@/lib/ui/breakpoints';
import { CatalogColumn, SheetScrim } from './CatalogColumn';
import { EdgeRail } from './EdgeRail';
import { StatusAnnouncer } from './StatusAnnouncer';
import { uiStore } from './uiStore';
import { useCatalogFocusRepair } from './useCatalogFocusRepair';
import { useLayoutTier } from './useLayoutTier';

// The panel body: the catalog column, with the search form at its head, and the
// dominant grid. ADR-0048 removes the search rail at every width. The catalog column
// mounts once and docks beside the grid from the lg tier; below it the column is a
// slide over sheet toggled from the header, with a scrim over the grid while it is
// open. The open sheet is modal over the grid: the grid region under the scrim is
// inert, and the scrim is a pointer target only, not a tab stop, because the sheet
// header close carries the same action. The sheet open state lives in the ui store. On
// the docked tiers the edge rail follows the column in the tree and takes its place
// while it is hidden. The grid region hosts the weekly timetable, which renders from
// the plan snapshots.
// The status announcer sits beside the column and outside the inert grid region, so it
// outlives every state the column swaps and still speaks a search outcome while the
// sheet is open or closed or the docked column is hidden. Preview has no search, so it
// carries no announcer. During a block drag the remove zone is the docked column, which
// the column renders itself, or else the bar along the body's bottom edge.
export function Layout() {
  const tier = useLayoutTier();
  const viewMode = useStore(uiStore, (state) => state.viewMode);
  const sheetOpen = useStore(uiStore, (state) => state.sheetOpen);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  useCatalogFocusRepair(bodyRef, tier);
  const sheetModal = !isDockedTier(tier) && sheetOpen;

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
      <div ref={bodyRef} className="relative flex h-full">
        <StatusAnnouncer />
        <CatalogColumn tier={tier} />
        {isDockedTier(tier) ? <EdgeRail /> : null}

        <div
          inert={sheetModal || undefined}
          className="min-w-0 flex-1 overflow-hidden p-4"
        >
          <PlannerDropZone>
            <PlannerPanel />
          </PlannerDropZone>
        </div>

        <SheetScrim tier={tier} />
        <RemoveBar tier={tier} />
      </div>
    </PlannerDnd>
  );
}
