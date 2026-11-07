// The head of the catalog column: the summary bar of the running search over the
// folding search form. Before any user search there is no bar and the form shows in
// full. A user search folds the form in the same commit that adds the bar, so the
// press is visibly accepted at once and the results rise into the space the form
// leaves. The form stays mounted while folded, so its fields and comboboxes keep their
// state for the next edit, and the folded region is inert so Tab skips it. The region
// scrolls on its own when a reopened form is taller than the room above the results.
// Escape inside the head folds a reopened form back under its bar. An open combobox
// list claims the press first, and without a bar there is nothing to fold to, so the
// press goes on to the overlay as before (ADR-0056). The head only catches the press
// bubbling from its controls, so it is a presentational wrapper with no role of its own.
//
// On the phone layout an open form fills the catalog pane: the head lays over the results,
// which the column keeps mounted but hidden and inert beneath it, so their scroll offset
// waits for the fold. The submit row is pinned to the foot of the form scroller, above the
// bottom nav, and the scroller pads its focus scroll by the row's measured height so a
// focused field never sits under it (WCAG 2.4.11). While a bar exists the row carries a
// cancel that folds the form back under it, the same fold Escape gives.
//
// The head seeds the search on the first open of the page session. A search persisted
// before a reload reopens folded into its bar; until the seed lands the head holds a
// fixed placeholder with neither the form nor the bar, so nothing paints and then flips.

import { useLayoutEffect, useRef, type KeyboardEvent } from 'react';
import { useStore } from 'zustand';
import { claimEscape } from '@/lib/ui/escape';
import { commitAndFocus } from '@/features/shell/commitAndFocus';
import { useElementSize } from '@/features/shell/useElementSize';
import { SearchForm } from './SearchForm';
import { useSearchDeps } from './SearchDepsContext';
import { SEARCH_DISCLOSURE_ID, SEARCH_FORM_ID } from './searchIds';
import { SearchSummaryBar } from './SearchSummaryBar';
import { searchStore, selectFormOpen } from './searchStore';
import { useHashRoute } from './useHashRoute';
import { useSearchInit } from './useSearchController';

/** The fold back under the bar; it turns the form inert, so focus moves to the
 * disclosure that reopens it. */
function foldForm(from: Element): void {
  commitAndFocus(from, SEARCH_DISCLOSURE_ID, () => {
    searchStore.getState().setSearchFormOpen(false);
  });
}

interface SearchHeaderProps {
  /** The phone layout, where an open form fills the pane. */
  compact?: boolean;
}

export function SearchHeader({ compact = false }: SearchHeaderProps) {
  useSearchInit(useSearchDeps(), useHashRoute());
  const restorePending = useStore(searchStore, (state) => state.restorePending);
  // The height of a folded bar, so the results below do not jump when it lands.
  return restorePending ? (
    <div aria-hidden className="h-14 flex-none border-b border-border" />
  ) : (
    <SearchHead compact={compact} />
  );
}

function SearchHead({ compact = false }: SearchHeaderProps) {
  const barQuery = useStore(searchStore, (state) => state.barQuery);
  const formOpen = useStore(searchStore, selectFormOpen);
  const formScroller = useRef<HTMLDivElement>(null);
  const submitRow = useRef<HTMLDivElement>(null);
  const submitRowHeight = useElementSize(submitRow).height;

  // Each expand shows the form from its first field.
  useLayoutEffect(() => {
    if (formOpen && formScroller.current !== null) {
      formScroller.current.scrollTop = 0;
    }
  }, [formOpen]);

  const barVisible = barQuery !== null;
  const fill = compact && formOpen;

  // The Escape that ends an input method composition in a field belongs to the editor,
  // as the sheet and the overlay trap already rule, so it never folds the form.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (barVisible && formOpen && claimEscape(event)) {
      foldForm(event.currentTarget);
    }
  };

  return (
    <div
      role="presentation"
      className={
        fill
          ? 'absolute inset-0 flex flex-col bg-surface'
          : 'flex min-h-0 flex-initial flex-col'
      }
      onKeyDown={handleKeyDown}
    >
      {barVisible ? <SearchSummaryBar query={barQuery} /> : null}
      <div
        id={SEARCH_FORM_ID}
        data-open={formOpen ? 'true' : 'false'}
        inert={!formOpen || undefined}
        className={`kcp-fold min-h-0 ${fill ? 'flex-1' : ''}`}
      >
        <div
          ref={formScroller}
          className="kcp-scroll overscroll-contain [scroll-padding-bottom:var(--kcp-overlay-bottom,0px)]"
          style={
            fill
              ? {
                  scrollPaddingBottom: `calc(${String(submitRowHeight)}px + var(--kcp-overlay-bottom, 0px))`,
                }
              : undefined
          }
        >
          {/* The padding sits inside the scroller, so the submit focus outline is
              never clipped by the scroller edge. */}
          <div className="border-b border-border px-6 pt-4 pb-6">
            <SearchForm
              dock={{
                ref: submitRow,
                sticky: fill,
                onCancel: fill && barVisible ? foldForm : null,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
