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

import { useLayoutEffect, useRef, type KeyboardEvent } from 'react';
import { useStore } from 'zustand';
import { claimEscape } from '@/lib/ui/escape';
import { commitAndFocus } from '@/features/shell/commitAndFocus';
import { SearchForm } from './SearchForm';
import { SEARCH_DISCLOSURE_ID, SEARCH_FORM_ID } from './searchIds';
import { SearchSummaryBar } from './SearchSummaryBar';
import { searchStore, selectFormOpen } from './searchStore';

export function SearchHeader() {
  const barQuery = useStore(searchStore, (state) => state.barQuery);
  const formOpen = useStore(searchStore, selectFormOpen);
  const formScroller = useRef<HTMLDivElement>(null);

  // Each expand shows the form from its first field.
  useLayoutEffect(() => {
    if (formOpen && formScroller.current !== null) {
      formScroller.current.scrollTop = 0;
    }
  }, [formOpen]);

  const barVisible = barQuery !== null;

  // The fold turns the form inert, so focus moves to the disclosure that reopens it. The
  // Escape that ends an input method composition in a field belongs to the editor, as
  // the sheet and the overlay trap already rule, so it never folds the form.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (barVisible && formOpen && claimEscape(event)) {
      commitAndFocus(event.currentTarget, SEARCH_DISCLOSURE_ID, () => {
        searchStore.getState().setSearchFormOpen(false);
      });
    }
  };

  return (
    <div
      role="presentation"
      className="flex min-h-0 flex-initial flex-col"
      onKeyDown={handleKeyDown}
    >
      {barVisible ? <SearchSummaryBar query={barQuery} /> : null}
      <div
        id={SEARCH_FORM_ID}
        data-open={formOpen ? 'true' : 'false'}
        inert={!formOpen || undefined}
        className="kcp-fold min-h-0"
      >
        <div ref={formScroller} className="kcp-scroll overscroll-contain">
          {/* The padding sits inside the scroller, so the submit focus outline is
              never clipped by the scroller edge. */}
          <div className="border-b border-border px-6 pt-4 pb-6">
            <SearchForm />
          </div>
        </div>
      </div>
    </div>
  );
}
