// The summary bar the search form folds into once a user search starts. It names the
// tab and the term of that search and carries a status slot that reads the busy text
// while the query runs and the course count once it settles, so the press is visibly
// accepted even when a cached answer changes nothing else. It is a focusable region,
// not a live region: the busy text is read when focus lands on the bar, and settled
// outcomes stay with the panel's existing announcers. The disclosure keeps one label
// and reports its state through aria-expanded, so it never moves under the pointer.

import { useStore } from 'zustand';
import { ChevronDown, LoaderCircle } from 'lucide-react';
import type { TeachTableQuery } from '@/lib/messaging/protocol';
import type { Translate } from '@/lib/i18n/t';
import { fillTemplate } from '@/lib/i18n/template';
import { FOCUS_RING } from '@/lib/ui/focus';
import { useTranslation } from '@/features/shell/useTranslation';
import {
  SEARCH_BAR_ID,
  SEARCH_DISCLOSURE_ID,
  SEARCH_FORM_ID,
} from './searchIds';
import { searchStore, selectFormOpen } from './searchStore';
import { TAB_ICON, TAB_LABEL } from './searchTabs';

const SUMMARY_ID = 'kcp-search-bar-summary';
const TERM_ID = 'kcp-search-bar-term';
const STATUS_ID = 'kcp-search-bar-status';

interface StatusSlotProps {
  busy: boolean;
  courses: number | null;
  t: Translate;
}

function StatusSlot({ busy, courses, t }: StatusSlotProps) {
  if (busy) {
    // The spinner stops after eight turns, about when the slow notice takes over, and
    // is a static icon under reduced motion.
    return (
      <span className="kcp-fade-in inline-flex items-center gap-1">
        <LoaderCircle
          size={14}
          strokeWidth={2}
          aria-hidden
          className="animate-spin [animation-iteration-count:8] motion-reduce:animate-none"
        />
        {t('search.loading')}
      </span>
    );
  }
  // An error leaves the slot empty, because the error card below carries the message.
  if (courses === null) {
    return null;
  }
  return (
    <span className="kcp-fade-in tabular-nums">
      {fillTemplate(t('search.summary.count'), { courses })}
    </span>
  );
}

interface SearchSummaryBarProps {
  query: TeachTableQuery;
}

export function SearchSummaryBar({ query }: SearchSummaryBarProps) {
  const { t } = useTranslation();
  const formOpen = useStore(searchStore, selectFormOpen);
  const busy = useStore(
    searchStore,
    (state) => state.result.status === 'loading',
  );
  const courses = useStore(searchStore, (state) =>
    state.result.status === 'ready' ? state.result.data.courses.length : null,
  );
  const TabIcon = TAB_ICON[query.mode];

  return (
    <div
      id={SEARCH_BAR_ID}
      role="region"
      tabIndex={-1}
      aria-label={t('search.bar.label')}
      aria-describedby={`${SUMMARY_ID} ${TERM_ID} ${STATUS_ID}`}
      className={`flex flex-none flex-col gap-1 border-b border-border bg-surface px-4 py-2 ${FOCUS_RING}`}
    >
      <div className="flex items-center gap-2 text-sm text-ink">
        <TabIcon
          size={16}
          strokeWidth={2}
          aria-hidden
          className="shrink-0 text-ink-soft"
        />
        <span id={SUMMARY_ID} className="min-w-0 flex-1 truncate">
          {t(TAB_LABEL[query.mode])}
        </span>
        <button
          id={SEARCH_DISCLOSURE_ID}
          type="button"
          aria-expanded={formOpen}
          aria-controls={SEARCH_FORM_ID}
          onClick={(event) => {
            // The second click of a double click would close the form it just opened.
            if (event.detail > 1) {
              return;
            }
            searchStore.getState().setSearchFormOpen(!formOpen);
          }}
          className={`inline-flex min-h-6 shrink-0 items-center gap-1 rounded-kcp px-2 py-0.5 text-sm text-ink transition-colors hover:bg-surface-alt pointer-coarse:min-h-11 ${FOCUS_RING}`}
        >
          {t('search.bar.edit')}
          <ChevronDown
            size={16}
            strokeWidth={2}
            aria-hidden
            className={`transition-transform duration-base motion-reduce:transition-none ${
              formOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
        <span
          id={TERM_ID}
          className="rounded-kcp-inner bg-surface-alt px-1.5 py-0.5"
        >
          {fillTemplate(t('search.summary.term'), {
            semester: query.selected_semester,
            year: query.selected_year,
          })}
        </span>
        <span id={STATUS_ID}>
          <StatusSlot busy={busy} courses={courses} t={t} />
        </span>
      </div>
    </div>
  );
}
