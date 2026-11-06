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
// closes the sheet. Escape closes the sheet alone, claimed in a React handler on the
// sheet so an inner surface that holds focus, such as an open combobox list, claims the
// press first and the overlay behind stays open (ADR-0056). Every sheet close returns
// focus to the header toggle, because the control that closed it turns inert.
//
// While a section or course dragged out of the open sheet is live, the sheet yields: it
// slides to a 24 px peek and its scrim fades and lets the pointer through, so the grid is
// the live target, and both return when the drag ends. The sheet stays mounted through
// the slide, so the list keeps its scroll offset (ADR-0059).
//
// The docked column can be hidden to give the grid the full width; hidden, it leaves the
// flow but stays mounted, laid out at its width and inert, so its scroll offset and
// search state wait for its return, and the edge rail takes its place as the way back.
// Showing and hiding it slides it from the leading edge, driven by the catalogVisibility
// funnels, with the drawer shadow on a child of its own so the slide animates transform
// and opacity only.

import { useLayoutEffect, useRef, type KeyboardEvent } from 'react';
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
import { dragStore, type DragStore } from '@/features/planner/dragStore';
import {
  isDockedTier,
  type DockedTier,
  type LayoutTier,
} from '@/lib/ui/breakpoints';
import { claimEscape } from '@/lib/ui/escape';
import { FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_SIZE } from '@/lib/ui/target';
import {
  CATALOG_COLUMN_ID,
  CATALOG_HIDE_ID,
  closeSheet,
  hideCatalog,
} from './catalogVisibility';
import { uiStore } from './uiStore';
import { useFocusTrap } from './useFocusTrap';
import { useTranslation } from './useTranslation';

/** Id of the sheet heading, which names the open sheet dialog. */
const SHEET_TITLE_ID = 'kcp-catalog-sheet-title';

// The Escape that ends an input method composition in a sheet field belongs to the
// editor, as the overlay trap already rules, so it never closes the sheet.
function handleSheetKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
  if (event.nativeEvent.isComposing) return;
  if (claimEscape(event)) {
    closeSheet(event.currentTarget);
  }
}

const DOCKED_WIDTH: Record<DockedTier, string> = {
  lg: 'w-[22rem]',
  xl: 'w-96',
  '2xl': 'w-[26rem]',
};

const SURFACE = 'flex flex-col border-r border-border bg-surface';

/** Whether a drag that starts in the catalog is live: a section or a course drag. A block
 * drag starts on the grid, so the sheet has nothing to yield to it. */
function selectCatalogDrag(state: DragStore): boolean {
  return state.active !== null || state.courseDrag !== null;
}

/** Whether an open sheet yields to the grid. The docked column sits beside the grid and
 * never yields, so a docked tier reads false and skips the re-render a drag would cause. */
function useSheetYield(tier: LayoutTier): boolean {
  return useStore(
    dragStore,
    (state) => !isDockedTier(tier) && selectCatalogDrag(state),
  );
}

function sheetPlacement(sheetOpen: boolean, yielded: boolean): string {
  if (!sheetOpen) {
    return '-translate-x-full';
  }
  return yielded ? 'translate-x-[calc(24px-100%)]' : 'translate-x-0';
}

function containerClass(
  tier: LayoutTier,
  sheetOpen: boolean,
  catalogVisible: boolean,
  yielded: boolean,
): string {
  if (isDockedTier(tier)) {
    // Hidden, the column leaves the flow so the grid takes the width, but keeps its box
    // so the scroller holds its offset; visibility removes it from view and the tab order.
    // It shares the edge rail's layer, and the rail comes later in the tree, so the rail
    // paints above it. Shown, it is positioned too, so its slide shadow covers its box.
    const placement = catalogVisible
      ? 'relative shrink-0'
      : 'invisible absolute inset-y-0 left-0 z-drawer';
    return `${SURFACE} ${placement} ${DOCKED_WIDTH[tier]}`;
  }
  return `${SURFACE} absolute inset-y-0 left-0 z-drawer w-[24rem] max-w-[90vw] shadow-kcp outline-none transition-transform duration-base motion-reduce:transition-none ${sheetPlacement(sheetOpen, yielded)}`;
}

/** The scrim over the grid while the sheet is open. It is a pointer target only, not a
 * tab stop, because the sheet header close carries the same action. While the sheet
 * yields to a drag it fades and lets the pointer through, so the grid it covers is the
 * visible target. */
export function SheetScrim({ tier }: { tier: LayoutTier }) {
  const sheetOpen = useStore(uiStore, (state) => state.sheetOpen);
  const yielded = useSheetYield(tier);
  if (isDockedTier(tier) || !sheetOpen) {
    return null;
  }
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-hidden="true"
      onClick={(event) => {
        closeSheet(event.currentTarget);
      }}
      className={`absolute inset-0 z-scrim bg-ink/30 transition-opacity duration-base motion-reduce:transition-none ${
        yielded ? 'pointer-events-none opacity-0' : ''
      }`}
    />
  );
}

function SheetHeader() {
  const { t } = useTranslation();
  const count = useResultCourseCount();

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
          onClick={(event) => {
            closeSheet(event.currentTarget);
          }}
          className={`inline-flex items-center justify-center rounded-kcp p-2 text-ink-soft transition-colors hover:bg-surface-alt hover:text-ink ${TARGET_SIZE} ${FOCUS_RING}`}
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
  const yielded = useSheetYield(tier) && sheetOpen;
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
      onKeyDown={sheetModal ? handleSheetKeyDown : undefined}
      aria-hidden={shown ? undefined : true}
      inert={!shown || undefined}
      data-yielded={yielded || undefined}
      className={containerClass(tier, sheetOpen, catalogVisible, yielded)}
    >
      {docked ? (
        <>
          <span
            data-catalog-shadow
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0 shadow-kcp"
          />
          <DockedHeader />
        </>
      ) : (
        <SheetHeader />
      )}
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
