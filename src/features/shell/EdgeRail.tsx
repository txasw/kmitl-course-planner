// The edge rail of ADR-0048: a 44 px strip that takes the docked catalog column's place
// while the column is hidden, so the way back is where the column went. Its top cell
// matches the docked header row and its icon centres where the hide control's icon was,
// so hiding and restoring is two clicks on one point. Below the icon it repeats the
// result count, or a busy dot while a search is in flight, so a hidden column never hides
// that something happened. It is one native button with an action name and no expanded
// state, since it can only show the column. It owns its own store subscriptions, so the
// unmemoized panel tree in Layout never re-renders for them, and during any drag it takes
// no pointer events, because nothing may resize the grid while a drag holds its frame.

import { useStore } from 'zustand';
import { PanelLeftOpen } from 'lucide-react';
import { CountChip } from '@/components/CountChip';
import { useResultCourseCount } from '@/features/catalog/CatalogPanel';
import { dragStore, selectDragging } from '@/features/planner/dragStore';
import { searchStore } from '@/features/search/searchStore';
import { fillTemplate } from '@/lib/i18n/template';
import { isDockedTier } from '@/lib/ui/breakpoints';
import { FOCUS_RING } from '@/lib/ui/focus';
import { CATALOG_COLUMN_ID } from './CatalogColumn';
import { CATALOG_RAIL_ID, showCatalog } from './catalogVisibility';
import { uiStore } from './uiStore';
import { useLayoutTier } from './useLayoutTier';
import { useTranslation } from './useTranslation';

export function EdgeRail() {
  const { t } = useTranslation();
  const tier = useLayoutTier();
  const viewMode = useStore(uiStore, (state) => state.viewMode);
  const catalogVisible = useStore(uiStore, (state) => state.catalogVisible);
  const dragging = useStore(dragStore, selectDragging);
  const count = useResultCourseCount();
  const loading = useStore(
    searchStore,
    (state) => state.result.status === 'loading',
  );

  if (!isDockedTier(tier) || viewMode !== 'edit' || catalogVisible) {
    return null;
  }

  const name = loading
    ? t('catalog.rail.loading')
    : count === null
      ? t('catalog.show')
      : fillTemplate(t('catalog.rail.name'), { count });

  return (
    <button
      id={CATALOG_RAIL_ID}
      type="button"
      aria-controls={CATALOG_COLUMN_ID}
      aria-label={name}
      data-dragging={dragging || undefined}
      onClick={(event) => {
        showCatalog(event.currentTarget, event.detail);
      }}
      className={`relative z-drawer flex w-11 shrink-0 flex-col items-center border-r border-border bg-surface text-ink-soft transition-colors hover:bg-surface-alt hover:text-ink ${
        dragging ? 'pointer-events-none' : ''
      } ${FOCUS_RING}`}
    >
      <span className="flex h-12 w-full shrink-0 items-center justify-center border-b border-border">
        <PanelLeftOpen size={16} strokeWidth={2} aria-hidden />
      </span>
      <span aria-hidden className="mt-3 flex min-h-5 items-center">
        {loading ? (
          <span
            data-rail-busy
            className="block size-2 animate-pulse rounded-full bg-primary motion-reduce:animate-none"
          />
        ) : count === null ? null : (
          <CountChip count={count} />
        )}
      </span>
      <span
        aria-hidden
        className="mt-2 rotate-180 text-xs [writing-mode:vertical-rl]"
      >
        {t('catalog.open')}
      </span>
    </button>
  );
}
