// The header control that brings the catalog column into view. Where the column is a
// sheet it opens and closes the sheet, so it is always present there; where the column
// docks it only restores a hidden column, so it shows only while the column is hidden.
// It carries a visible label and the result course count, and the count is part of its
// accessible name, so a hidden or closed catalog still tells the user how many courses
// the last search found. Preview has no catalog, so the toggle is absent there.

import { useStore } from 'zustand';
import { List } from 'lucide-react';
import { useResultCourseCount } from '@/features/catalog/CatalogPanel';
import { isDockedTier } from '@/lib/ui/breakpoints';
import { FOCUS_RING } from '@/lib/ui/focus';
import {
  CATALOG_COLUMN_ID,
  CATALOG_HIDE_ID,
  CATALOG_TOGGLE_ID,
} from './CatalogColumn';
import { commitAndFocus } from './commitAndFocus';
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
  const catalogVisible = useStore(uiStore, (state) => state.catalogVisible);
  const setCatalogVisible = useStore(
    uiStore,
    (state) => state.setCatalogVisible,
  );
  const docked = isDockedTier(tier);

  if (viewMode !== 'edit' || (docked && catalogVisible)) return null;

  const label = t('catalog.open');
  const expanded = docked ? false : sheetOpen;

  return (
    <button
      id={CATALOG_TOGGLE_ID}
      type="button"
      onClick={(event) => {
        if (docked) {
          commitAndFocus(event.currentTarget, CATALOG_HIDE_ID, () => {
            setCatalogVisible(true);
          });
        } else {
          setSheetOpen(!sheetOpen);
        }
      }}
      aria-controls={CATALOG_COLUMN_ID}
      aria-expanded={expanded}
      aria-label={count === null ? label : `${label} ${String(count)}`}
      title={docked ? t('catalog.show') : undefined}
      className={`inline-flex items-center gap-1.5 rounded-kcp px-2.5 py-1.5 text-sm text-ink transition-colors hover:bg-surface-alt ${
        expanded ? 'bg-surface-alt' : ''
      } ${FOCUS_RING}`}
    >
      <List size={18} strokeWidth={2} aria-hidden />
      <span>{label}</span>
      {count === null ? null : (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-border bg-surface px-1.5 text-2xs font-semibold tabular-nums text-ink">
          {count}
        </span>
      )}
    </button>
  );
}
