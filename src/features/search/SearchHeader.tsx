// The head of the catalog column: the summary bar of the running search over the
// folding search form. Before any user search there is no bar and the form shows in
// full. A user search folds the form in the same commit that adds the bar, so the
// press is visibly accepted at once and the results rise into the space the form
// leaves. The form stays mounted while folded, so its fields and comboboxes keep their
// state for the next edit, and the folded region is inert so Tab skips it. The region
// scrolls on its own when a reopened form is taller than the room above the results.

import { useLayoutEffect, useRef } from 'react';
import { useStore } from 'zustand';
import { SearchForm } from './SearchForm';
import { SEARCH_FORM_ID } from './searchIds';
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

  return (
    <div className="flex min-h-0 flex-initial flex-col">
      {barQuery === null ? null : <SearchSummaryBar query={barQuery} />}
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
