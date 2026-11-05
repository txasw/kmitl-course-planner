import { useStore } from 'zustand';
import { PlannerPanel } from '@/features/planner/PlannerPanel';
import { PlannerDnd } from '@/features/planner/PlannerDnd';
import { PlannerDropZone } from '@/features/planner/PlannerDropZone';
import { SearchForm } from '@/features/search/SearchForm';
import { isDockedTier } from '@/lib/ui/breakpoints';
import { CatalogColumn } from './CatalogColumn';
import { uiStore } from './uiStore';
import { useLayoutTier } from './useLayoutTier';
import { useTranslation } from './useTranslation';

// The panel body: a left search rail, the catalog column, and a dominant grid. The
// catalog column mounts once and docks beside the grid from the lg tier; below it the
// column is a slide over sheet toggled from the header, with a scrim over the grid while
// it is open. The sheet open state lives in the ui store. The grid region hosts the
// weekly timetable, which renders from the plan snapshots.
export function Layout() {
  const { t } = useTranslation();
  const tier = useLayoutTier();
  const viewMode = useStore(uiStore, (state) => state.viewMode);
  const sheetOpen = useStore(uiStore, (state) => state.sheetOpen);
  const setSheetOpen = useStore(uiStore, (state) => state.setSheetOpen);

  // Preview collapses the search rail and catalog out of the DOM and gives the
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
      <div className="relative flex h-full">
        <div className="w-80 shrink-0 kcp-scroll overflow-y-auto border-r border-border p-6">
          <SearchForm />
        </div>

        <CatalogColumn tier={tier} />

        <div className="min-w-0 flex-1 overflow-hidden p-4">
          <PlannerDropZone>
            <PlannerPanel />
          </PlannerDropZone>
        </div>

        {!isDockedTier(tier) && sheetOpen ? (
          <button
            type="button"
            aria-label={t('catalog.sheet.close')}
            onClick={() => {
              setSheetOpen(false);
            }}
            className="absolute inset-0 z-scrim bg-ink/30"
          />
        ) : null}
      </div>
    </PlannerDnd>
  );
}
