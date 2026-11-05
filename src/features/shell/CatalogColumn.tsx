// The catalog column of ADR-0048: the search form at its head, then the filter bar and
// the results, in one scroller. It mounts exactly once at every width and only its
// container class follows the layout tier: docked beside the grid from the lg tier, or a
// slide over left sheet below it. Switching a class on one element, rather than rendering
// the catalog in two places, keeps a single drag surface per section and lets the drag
// registration and the scroll offset survive a tier change. The closed sheet stays
// mounted, so the session state of 6.1 is never dropped.

import { useStore } from 'zustand';
import { X } from 'lucide-react';
import {
  CatalogPanel,
  useResultCourseCount,
} from '@/features/catalog/CatalogPanel';
import { SearchForm } from '@/features/search/SearchForm';
import {
  isDockedTier,
  type DockedTier,
  type LayoutTier,
} from '@/lib/ui/breakpoints';
import { FOCUS_RING } from '@/lib/ui/focus';
import { uiStore } from './uiStore';
import { useTranslation } from './useTranslation';

/** Id the header sheet toggle points its aria-controls at. */
export const CATALOG_COLUMN_ID = 'kcp-catalog-column';

const DOCKED_WIDTH: Record<DockedTier, string> = {
  lg: 'w-[22rem]',
  xl: 'w-96',
  '2xl': 'w-[26rem]',
};

const SURFACE = 'flex flex-col border-r border-border bg-surface';

function containerClass(tier: LayoutTier, sheetOpen: boolean): string {
  if (isDockedTier(tier)) {
    return `${SURFACE} shrink-0 ${DOCKED_WIDTH[tier]}`;
  }
  return `${SURFACE} absolute inset-y-0 left-0 z-drawer w-[24rem] max-w-[90vw] shadow-kcp transition-transform duration-base motion-reduce:transition-none ${
    sheetOpen ? 'translate-x-0' : '-translate-x-full'
  }`;
}

function SheetHeader() {
  const { t } = useTranslation();
  const count = useResultCourseCount();
  const setSheetOpen = useStore(uiStore, (state) => state.setSheetOpen);

  return (
    <div className="flex items-center gap-2 border-b border-border px-4 py-3">
      <h3 className="text-sm font-semibold text-ink">
        {t('catalog.sheet.title')}
      </h3>
      {count === null ? null : (
        <span className="text-xs text-ink-soft">
          {count} {t('catalog.units.course')}
        </span>
      )}
      <button
        type="button"
        aria-label={t('catalog.sheet.close')}
        onClick={() => {
          setSheetOpen(false);
        }}
        className={`ml-auto inline-flex items-center justify-center rounded-kcp p-2 text-ink-soft transition-colors hover:bg-surface-alt hover:text-ink ${FOCUS_RING}`}
      >
        <X size={18} strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}

interface CatalogColumnProps {
  tier: LayoutTier;
}

export function CatalogColumn({ tier }: CatalogColumnProps) {
  const sheetOpen = useStore(uiStore, (state) => state.sheetOpen);
  const docked = isDockedTier(tier);

  return (
    <div
      id={CATALOG_COLUMN_ID}
      aria-hidden={docked ? undefined : !sheetOpen}
      className={containerClass(tier, sheetOpen)}
    >
      {docked ? null : <SheetHeader />}
      <div className="flex min-h-0 flex-1 flex-col gap-6 kcp-scroll overflow-y-auto p-6">
        <div className="border-b border-border pb-6">
          <SearchForm />
        </div>
        <CatalogPanel />
      </div>
    </div>
  );
}
