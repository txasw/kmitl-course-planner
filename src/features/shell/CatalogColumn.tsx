// The catalog column of ADR-0048: the container header, the search head (the summary
// bar over the folding search form), then the filter bar and the results in their own
// scroller. The container header also carries the plan suggestion action of ADR-0054
// when the result is a curriculum search. The search head sits outside the results
// scroller, so the bar stays in view while a long list scrolls and opening or closing the
// form never moves the list. While a reopened form is taller than the room left, it
// scrolls in its own region above a minimum of results. It mounts exactly once at every
// width and only its container class follows the layout tier: docked beside the grid
// from the lg tier, or a slide over left sheet below it. Switching a class on one
// element, rather than rendering the catalog in two places, keeps a single drag surface
// per section and lets the drag registration and the scroll offset survive a tier
// change.
//
// The closed sheet stays mounted, so the session state of 6.1 is never dropped, and it
// is inert, so Tab and assistive technology never reach the controls it holds off
// screen. The open sheet is a labelled dialog over the grid: it takes focus as it opens
// and keeps Tab inside it with its own focus trap, while Layout makes the grid region
// under the scrim inert. The header above the scrim stays operable, so its toggle still
// closes the sheet.
//
// The docked column can be hidden to give the grid the full width; hidden, it leaves the
// flow but stays mounted, laid out at its width and inert, so its scroll offset and
// search state wait for its return, and the edge rail takes its place as the way back.

import { useLayoutEffect, useRef } from 'react';
import { useStore } from 'zustand';
import { PanelLeftClose, X } from 'lucide-react';
import {
  CatalogPanel,
  useResultCourseCount,
} from '@/features/catalog/CatalogPanel';
import { SearchHeader } from '@/features/search/SearchHeader';
import {
  searchStore,
  selectBarVisible,
  selectFormOpen,
} from '@/features/search/searchStore';
import { SuggestAction } from '@/features/catalog/SuggestAction';
import {
  isDockedTier,
  type DockedTier,
  type LayoutTier,
} from '@/lib/ui/breakpoints';
import { FOCUS_RING } from '@/lib/ui/focus';
import { CATALOG_HIDE_ID, hideCatalog } from './catalogVisibility';
import { uiStore } from './uiStore';
import { useFocusTrap } from './useFocusTrap';
import { useTranslation } from './useTranslation';

/** Id the header sheet toggle points its aria-controls at. */
export const CATALOG_COLUMN_ID = 'kcp-catalog-column';

/** Id of the sheet heading, which names the open sheet dialog. */
const SHEET_TITLE_ID = 'kcp-catalog-sheet-title';

const DOCKED_WIDTH: Record<DockedTier, string> = {
  lg: 'w-[22rem]',
  xl: 'w-96',
  '2xl': 'w-[26rem]',
};

const SURFACE = 'flex flex-col border-r border-border bg-surface';

function containerClass(
  tier: LayoutTier,
  sheetOpen: boolean,
  catalogVisible: boolean,
): string {
  if (isDockedTier(tier)) {
    // Hidden, the column leaves the flow so the grid takes the width, but keeps its box
    // so the scroller holds its offset; visibility removes it from view and the tab order.
    // It shares the edge rail's layer, and the rail comes later in the tree, so the rail
    // paints above it.
    const placement = catalogVisible
      ? 'shrink-0'
      : 'invisible absolute inset-y-0 left-0 z-drawer';
    return `${SURFACE} ${placement} ${DOCKED_WIDTH[tier]}`;
  }
  return `${SURFACE} absolute inset-y-0 left-0 z-drawer w-[24rem] max-w-[90vw] shadow-kcp outline-none transition-transform duration-base motion-reduce:transition-none ${
    sheetOpen ? 'translate-x-0' : '-translate-x-full'
  }`;
}

function SheetHeader() {
  const { t } = useTranslation();
  const count = useResultCourseCount();
  const setSheetOpen = useStore(uiStore, (state) => state.setSheetOpen);

  return (
    <div className="flex items-center gap-2 border-b border-border px-4 py-3">
      <h3 id={SHEET_TITLE_ID} className="text-sm font-semibold text-ink">
        {t('catalog.sheet.title')}
      </h3>
      {count === null ? null : (
        <span className="text-xs text-ink-soft">
          {count} {t('catalog.units.course')}
        </span>
      )}
      <div className="ml-auto flex items-center gap-1">
        <SuggestAction />
        <button
          type="button"
          aria-label={t('catalog.sheet.close')}
          onClick={() => {
            setSheetOpen(false);
          }}
          className={`inline-flex items-center justify-center rounded-kcp p-2 text-ink-soft transition-colors hover:bg-surface-alt hover:text-ink ${FOCUS_RING}`}
        >
          <X size={18} strokeWidth={2} aria-hidden />
        </button>
      </div>
    </div>
  );
}

function DockedHeader() {
  const { t } = useTranslation();

  // The control starts at the column's leading edge with a 44 px icon cell, the same
  // cell the edge rail opens with, so hide and restore sit on one point on screen.
  return (
    <div className="flex h-12 shrink-0 items-center justify-start border-b border-border pr-4">
      <button
        id={CATALOG_HIDE_ID}
        type="button"
        aria-controls={CATALOG_COLUMN_ID}
        onClick={(event) => {
          hideCatalog(event.currentTarget, event.detail);
        }}
        className={`inline-flex h-full items-center pr-3 text-sm text-ink-soft transition-colors hover:bg-surface-alt hover:text-ink ${FOCUS_RING}`}
      >
        <span className="flex w-11 shrink-0 justify-center">
          <PanelLeftClose size={16} strokeWidth={2} aria-hidden />
        </span>
        {t('catalog.hide')}
      </button>
      <div className="ml-auto">
        <SuggestAction />
      </div>
    </div>
  );
}

interface CatalogColumnProps {
  tier: LayoutTier;
}

export function CatalogColumn({ tier }: CatalogColumnProps) {
  const sheetOpen = useStore(uiStore, (state) => state.sheetOpen);
  const catalogVisible = useStore(uiStore, (state) => state.catalogVisible);
  const docked = isDockedTier(tier);
  const shown = docked ? catalogVisible : sheetOpen;
  const sheetModal = !docked && sheetOpen;
  const columnRef = useRef<HTMLDivElement>(null);
  // The trap contains Tab only; it takes no Escape callback, so the press is left to the
  // layers that own it.
  useFocusTrap(columnRef, sheetModal);
  // While the bar exists and the form is open, the results keep a 12rem minimum, so a
  // tall form scrolls in its own region rather than pushing the results out of view.
  const keepResults = useStore(
    searchStore,
    (state) => selectBarVisible(state) && selectFormOpen(state),
  );
  const lastSubmitAt = useStore(searchStore, (state) => state.lastSubmitAt);
  const results = useRef<HTMLDivElement>(null);

  // A new user search starts its results from the top, before the frame paints.
  useLayoutEffect(() => {
    if (lastSubmitAt !== null && results.current !== null) {
      results.current.scrollTop = 0;
    }
  }, [lastSubmitAt]);

  return (
    <div
      ref={columnRef}
      id={CATALOG_COLUMN_ID}
      role={docked ? undefined : 'dialog'}
      aria-labelledby={docked ? undefined : SHEET_TITLE_ID}
      tabIndex={docked ? undefined : -1}
      aria-hidden={shown ? undefined : true}
      inert={!shown || undefined}
      className={containerClass(tier, sheetOpen, catalogVisible)}
    >
      {docked ? <DockedHeader /> : <SheetHeader />}
      <SearchHeader />
      {/* The catalog owns its scroll anchoring: a card opening or closing changes
          only the content below its header, and the browser must not pick an anchor
          inside a body that is unmounting. */}
      <div
        ref={results}
        data-catalog-scroller
        className={`kcp-scroll flex flex-1 flex-col overflow-y-auto p-6 [overflow-anchor:none] ${
          keepResults ? 'min-h-48' : 'min-h-0'
        }`}
      >
        <CatalogPanel />
      </div>
    </div>
  );
}
