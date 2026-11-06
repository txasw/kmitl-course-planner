// The catalog column of ADR-0048: the container header, the search head (the summary
// bar over the folding search form), then the filter bar and the results in their own
// scroller. The container header also carries the plan suggestion action of ADR-0054
// when the result is a curriculum search. The search head sits outside the results
// scroller, so the bar stays in view while a long list scrolls and opening or closing the
// form never moves the list. While a reopened form is taller than the room left, it
// scrolls in its own region above a minimum of results. It mounts exactly once at every
// width and only its container class follows the layout tier: docked beside the grid
// from the lg tier, a slide over left sheet on the medium tier, or a full width pane
// below 640 px, which the bottom nav shows or hides. Switching a class on one
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
//
// While a placed block is dragged and the docked column is shown, the column is the
// remove zone (ADR-0059): its content dims to 30 percent under the zone overlay, so the
// student keeps their place in the list, and a drop anywhere on it removes the block.
//
// The hidden pane below 640 px follows the hidden docked column: it keeps its box in the
// shared grid cell, so its scroll offset holds, and it is invisible and inert. The pane
// header names the catalog and carries the plan suggestion action but no close, since the
// bottom nav switches panes. Below 640 px the catalog also turns drag off for every row
// and course header in it, because the timetable is not beside the list to drop on; the
// add buttons carry the add. An open search form fills the pane there, laid over the
// results, which stay mounted but invisible and inert until the form folds, so the list
// keeps its offset while the student edits the search.

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
import { CatalogDragContext } from '@/features/catalog/catalogDrag';
import { dragStore, type DragStore } from '@/features/planner/dragStore';
import {
  CatalogRemoveZone,
  useRemoveZoneActive,
} from '@/features/planner/RemoveZone';
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
import { useMobilePane } from './mobilePane';
import { uiStore, type MobilePane } from './uiStore';
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

// Dims every child but the remove zone overlay and the slide shadow, which stays at the
// zero opacity it rests at. Each dimmed child forms its own stacking context, so the
// overlay, the last child, paints above them all with no layer of its own.
const REMOVE_DIM =
  '[&>:not([data-remove-zone],[data-catalog-shadow])]:opacity-30';

/** Whether a drag that starts in the catalog is live: a section or a course drag. A block
 * drag starts on the grid, so the sheet has nothing to yield to it. */
function selectCatalogDrag(state: DragStore): boolean {
  return state.active !== null || state.courseDrag !== null;
}

/** Whether an open sheet yields to the grid. Only the medium tier has a sheet: the
 * docked column sits beside the grid and the compact pane starts no catalog drag, so
 * those tiers read false and skip the re-render a drag would cause. */
function useSheetYield(tier: LayoutTier): boolean {
  return useStore(
    dragStore,
    (state) => tier === 'medium' && selectCatalogDrag(state),
  );
}

/** Whether the column is in view: the docked choice, the sheet state, or the pane. */
function isShown(
  tier: LayoutTier,
  state: { sheetOpen: boolean; catalogVisible: boolean; pane: MobilePane },
): boolean {
  if (isDockedTier(tier)) return state.catalogVisible;
  if (tier === 'medium') return state.sheetOpen;
  return state.pane === 'catalog';
}

function sheetPlacement(sheetOpen: boolean, yielded: boolean): string {
  if (!sheetOpen) {
    return '-translate-x-full';
  }
  return yielded ? 'translate-x-[calc(24px-100%)]' : 'translate-x-0';
}

function containerClass(
  tier: LayoutTier,
  shown: boolean,
  yielded: boolean,
): string {
  if (tier === 'compact') {
    // The pane shares its grid cell with the grid region, so it keeps the same box
    // whether it shows or not.
    return `flex min-h-0 min-w-0 flex-col bg-surface col-start-1 row-start-1 ${
      shown ? '' : 'invisible'
    }`;
  }
  if (isDockedTier(tier)) {
    // Hidden, the column leaves the flow so the grid takes the width, but keeps its box
    // so the scroller holds its offset; visibility removes it from view and the tab order.
    // It shares the edge rail's layer, and the rail comes later in the tree, so the rail
    // paints above it. Shown, it is positioned too, so its slide shadow covers its box.
    const placement = shown
      ? 'relative shrink-0'
      : 'invisible absolute inset-y-0 left-0 z-drawer';
    return `${SURFACE} ${placement} ${DOCKED_WIDTH[tier]}`;
  }
  return `${SURFACE} absolute inset-y-0 left-0 z-drawer w-[24rem] max-w-[90vw] shadow-kcp outline-none transition-transform duration-base motion-reduce:transition-none ${sheetPlacement(shown, yielded)}`;
}

/** The scrim over the grid while the sheet is open. It is a pointer target only, not a
 * tab stop, because the sheet header close carries the same action. While the sheet
 * yields to a drag it fades and lets the pointer through, so the grid it covers is the
 * visible target. */
export function SheetScrim({ tier }: { tier: LayoutTier }) {
  const sheetOpen = useStore(uiStore, (state) => state.sheetOpen);
  const yielded = useSheetYield(tier);
  if (tier !== 'medium' || !sheetOpen) {
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

/** The header of the sheet and of the compact pane: the catalog name, the result count
 * and the plan suggestion action, with a close only on the sheet. */
function SheetHeader({ closable }: { closable: boolean }) {
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
        {closable ? (
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
        ) : null}
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
  const pane = useMobilePane();
  const docked = isDockedTier(tier);
  const sheet = tier === 'medium';
  const shown = isShown(tier, { sheetOpen, catalogVisible, pane });
  const sheetModal = sheet && sheetOpen;
  const columnRef = useRef<HTMLDivElement>(null);
  // The trap contains Tab only; it takes no Escape callback, so the press is left to the
  // layers that own it.
  useFocusTrap(columnRef, sheetModal);
  const yielded = useSheetYield(tier) && sheetOpen;
  const removeZone = useRemoveZoneActive(tier, 'column');
  const container = containerClass(tier, shown, yielded);
  // While the bar exists and the form is open, the results keep a 12rem minimum, so a
  // tall form scrolls in its own region rather than pushing the results out of view.
  const keepResults = useStore(
    searchStore,
    (state) => selectBarVisible(state) && selectFormOpen(state),
  );
  // Below 640 px an open form fills the pane, so the results under it are hidden and
  // inert, derived here from the tier and the disclosure and never stored, so a resize
  // out of the phone layout cannot leave them hidden.
  const compact = tier === 'compact';
  const editing = useStore(
    searchStore,
    (state) => compact && selectFormOpen(state),
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
      role={sheet ? 'dialog' : undefined}
      aria-labelledby={sheet ? SHEET_TITLE_ID : undefined}
      tabIndex={sheet ? -1 : undefined}
      onKeyDown={sheetModal ? handleSheetKeyDown : undefined}
      aria-hidden={shown ? undefined : true}
      inert={!shown || undefined}
      data-yielded={yielded || undefined}
      className={removeZone ? `${container} ${REMOVE_DIM}` : container}
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
        <SheetHeader closable={sheet} />
      )}
      {/* The body positions the search head, which lays over the results while an
          open form fills the phone pane. */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <SearchHeader compact={compact} />
        {/* The catalog owns its scroll anchoring: a card opening or closing changes
            only the content below its header, and the browser must not pick an
            anchor inside a body that is unmounting. The scroller is positioned, so it
            is the containing block of the screen reader text in the cards. Otherwise
            that text takes the body above as its containing block, escapes the clip,
            and gives the panel body scrollable overflow, which a scroll into view
            then uses to move the whole panel up. */}
        <div
          ref={results}
          data-catalog-scroller
          inert={editing || undefined}
          aria-hidden={editing || undefined}
          className={`kcp-scroll relative flex flex-1 flex-col overflow-y-auto p-6 [overflow-anchor:none] [scroll-padding-bottom:var(--kcp-overlay-bottom,0px)] ${
            keepResults ? 'min-h-48' : 'min-h-0'
          } ${editing ? 'invisible' : ''}`}
        >
          <CatalogDragContext.Provider value={!compact}>
            <CatalogPanel />
          </CatalogDragContext.Provider>
        </div>
      </div>
      {removeZone ? <CatalogRemoveZone /> : null}
    </div>
  );
}
