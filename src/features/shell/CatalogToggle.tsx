// The header control that opens and closes the catalog sheet, on the medium tier where
// the catalog column is a sheet. Where the column docks, the column's own hide control
// and the edge rail that takes its place show and hide it, and below 640 px the bottom
// nav switches to the catalog pane, so the toggle is absent on both and each tier has one
// way to the catalog. It carries a visible label and the result course count, and the
// count is part of its accessible name, so a closed sheet still tells the user how many
// courses the last search found. Preview has no catalog, so the toggle is absent there
// too.

import { useStore } from 'zustand';
import { List } from 'lucide-react';
import { CountChip } from '@/components/CountChip';
import { useResultCourseCount } from '@/features/catalog/CatalogPanel';
import { FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_SIZE } from '@/lib/ui/target';
import { CATALOG_COLUMN_ID, CATALOG_TOGGLE_ID } from './catalogVisibility';
import { uiStore } from './uiStore';
import { useLayoutTier } from './useLayoutTier';
import { useTranslation } from './useTranslation';

export function CatalogToggle() {
  const { t } = useTranslation();
  const tier = useLayoutTier();
  const count = useResultCourseCount();
  const viewMode = useStore(uiStore, (state) => state.viewMode);
  const sheetOpen = useStore(uiStore, (state) => state.sheetOpen);
  const setSheetOpen = useStore(uiStore, (state) => state.setSheetOpen);

  if (viewMode !== 'edit' || tier !== 'medium') return null;

  const label = t('catalog.open');

  return (
    <button
      id={CATALOG_TOGGLE_ID}
      type="button"
      onClick={() => {
        setSheetOpen(!sheetOpen);
      }}
      aria-controls={CATALOG_COLUMN_ID}
      aria-expanded={sheetOpen}
      aria-label={count === null ? label : `${label} ${String(count)}`}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-kcp px-2.5 py-1.5 text-sm text-ink transition-colors hover:bg-surface-alt ${
        sheetOpen ? 'bg-surface-alt' : ''
      } ${TARGET_SIZE} ${FOCUS_RING}`}
    >
      <List size={18} strokeWidth={2} aria-hidden />
      <span>{label}</span>
      {count === null ? null : <CountChip count={count} />}
    </button>
  );
}
