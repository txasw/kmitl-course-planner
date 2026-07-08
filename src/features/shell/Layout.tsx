import { useStore } from 'zustand';
import { CalendarDays } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { CatalogPanel } from '@/features/catalog/CatalogPanel';
import { SearchForm } from '@/features/search/SearchForm';
import { uiStore } from './uiStore';
import { useTranslation } from './useTranslation';

/** Id the header drawer toggle points its aria-controls at. */
export const DRAWER_ID = 'kcp-catalog-drawer';

// The three region body: a left search rail, a center catalog, and a dominant
// right grid. Below the xl breakpoint the catalog collapses into a slide over
// drawer toggled from the header; the drawer open state lives in the ui store.
// The search rail and catalog carry their features; the grid arrives in a later
// phase and keeps a designed empty state.
export function Layout() {
  const { t } = useTranslation();
  const drawerOpen = useStore(uiStore, (state) => state.drawerOpen);
  const setDrawer = useStore(uiStore, (state) => state.setDrawer);

  const catalog = <CatalogPanel />;

  return (
    <div className="relative flex h-full">
      <div className="w-80 shrink-0 overflow-y-auto border-r border-border p-6">
        <SearchForm />
      </div>

      <div className="hidden w-96 shrink-0 overflow-y-auto border-r border-border p-6 xl:block">
        {catalog}
      </div>

      <div className="min-w-0 flex-1 overflow-y-auto p-6">
        <EmptyState
          icon={CalendarDays}
          title={t('grid.emptyTitle')}
          description={t('grid.emptyBody')}
        />
      </div>

      <div className="xl:hidden">
        {drawerOpen ? (
          <button
            type="button"
            aria-label={t('catalog.drawerClose')}
            onClick={() => {
              setDrawer(false);
            }}
            className="absolute inset-0 z-10 bg-ink/30"
          />
        ) : null}
        <div
          id={DRAWER_ID}
          aria-hidden={!drawerOpen}
          className={`absolute inset-y-0 left-0 z-20 w-80 max-w-[85%] overflow-y-auto border-r border-border bg-surface p-6 shadow-kcp transition-transform duration-200 motion-reduce:transition-none ${
            drawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {catalog}
        </div>
      </div>
    </div>
  );
}
