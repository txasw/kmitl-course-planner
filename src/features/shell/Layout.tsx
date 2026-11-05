import { useStore } from 'zustand';
import { CatalogPanel } from '@/features/catalog/CatalogPanel';
import { PlannerPanel } from '@/features/planner/PlannerPanel';
import { PlannerDnd } from '@/features/planner/PlannerDnd';
import { PlannerDropZone } from '@/features/planner/PlannerDropZone';
import { SearchForm } from '@/features/search/SearchForm';
import { uiStore } from './uiStore';
import { useTranslation } from './useTranslation';

/** Id the header sheet toggle points its aria-controls at. */
export const DRAWER_ID = 'kcp-catalog-drawer';

// The three region body: a left search rail, a center catalog, and a dominant
// right grid. Below the xl breakpoint the catalog collapses into a slide over
// sheet toggled from the header; the sheet open state lives in the ui store.
// The search rail and catalog carry their features; the grid region hosts the
// weekly timetable, which renders from the plan snapshots.
export function Layout() {
  const { t } = useTranslation();
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

  const catalog = <CatalogPanel />;

  return (
    <PlannerDnd>
      <div className="relative flex h-full">
        <div className="w-80 shrink-0 kcp-scroll overflow-y-auto border-r border-border p-6">
          <SearchForm />
        </div>

        <div className="hidden w-96 shrink-0 kcp-scroll overflow-y-auto border-r border-border p-6 xl:block">
          {catalog}
        </div>

        <div className="min-w-0 flex-1 overflow-hidden p-4">
          <PlannerDropZone>
            <PlannerPanel />
          </PlannerDropZone>
        </div>

        <div className="xl:hidden">
          {sheetOpen ? (
            <button
              type="button"
              aria-label={t('catalog.drawerClose')}
              onClick={() => {
                setSheetOpen(false);
              }}
              className="absolute inset-0 z-scrim bg-ink/30"
            />
          ) : null}
          <div
            id={DRAWER_ID}
            aria-hidden={!sheetOpen}
            className={`absolute inset-y-0 left-0 z-drawer w-80 max-w-[85%] kcp-scroll overflow-y-auto border-r border-border bg-surface p-6 shadow-kcp transition-transform duration-base motion-reduce:transition-none ${
              sheetOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            {catalog}
          </div>
        </div>
      </div>
    </PlannerDnd>
  );
}
