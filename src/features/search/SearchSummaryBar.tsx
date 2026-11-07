// The summary bar the search form folds into once a user search starts. It names what
// was searched, the scope and the term of that search, and carries a status slot that
// reads the busy text while the query runs and the course count once it settles, so the
// press is visibly accepted even when a cached answer changes nothing else. The query
// name clamps to two lines, while the scope chips beside the term never truncate, so a
// long Thai category name cannot hide the faculty or class year that sets two alike
// searches apart. Once a catalog settles the bar says when its data was fetched, which
// turns warn past the cache lifetime, beside the action that loads the results again.
// It is a focusable region, not a live region: the busy text is read when focus lands
// on the bar, and settled outcomes stay with the panel's existing announcers. The
// disclosure keeps one label and reports its state through aria-expanded, so it never
// moves under the pointer.

import { useMemo } from 'react';
import { useStore } from 'zustand';
import { AlertTriangle, ChevronDown, Clock, LoaderCircle } from 'lucide-react';
import type { TeachTableQuery } from '@/lib/messaging/protocol';
import type { Translate } from '@/lib/i18n/t';
import { fillTemplate } from '@/lib/i18n/template';
import { describeQuery } from '@/lib/search/describeQuery';
import { TEACH_TABLE_TTL_MS } from '@/lib/storage/keys';
import { FOCUS_RING } from '@/lib/ui/focus';
import { checkedTime } from '@/features/planner/verificationText';
import { useTranslation } from '@/features/shell/useTranslation';
import {
  SEARCH_BAR_ID,
  SEARCH_DISCLOSURE_ID,
  SEARCH_FORM_ID,
} from './searchIds';
import { searchStore, selectFormOpen } from './searchStore';
import { ResultAction } from './ResultAction';
import { TAB_ICON } from './searchTabs';
import { useIsPast } from './useIsPast';

const SUMMARY_ID = 'kcp-search-bar-summary';
const TERM_ID = 'kcp-search-bar-term';
const STATUS_ID = 'kcp-search-bar-status';
const DATA_TIME_ID = 'kcp-search-bar-data-time';
const QUALIFIER_ID_PREFIX = 'kcp-search-bar-qualifier-';
const CHIP =
  'shrink-0 whitespace-nowrap rounded-kcp-inner bg-surface-alt px-1.5 py-0.5';

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

interface DataTimeProps {
  fetchedAt: number;
  t: Translate;
}

// How old the courses on screen are: the clock time of the fetch behind them, or the
// date and time for one from an earlier day. Past the cache lifetime a search would
// fetch again, so the line turns warn and its clock becomes a warning sign, a cue that
// does not rest on colour alone, and the refresh beside it is the way forward.
function DataTime({ fetchedAt, t }: DataTimeProps) {
  const stale = useIsPast(fetchedAt + TEACH_TABLE_TTL_MS);
  const Icon = stale ? AlertTriangle : Clock;
  return (
    <span
      id={DATA_TIME_ID}
      data-stale={stale ? 'true' : 'false'}
      className={`inline-flex items-center gap-1 tabular-nums ${stale ? 'text-warn' : ''}`}
    >
      <Icon size={12} strokeWidth={2} aria-hidden />
      {fillTemplate(t('search.bar.dataAsOf'), {
        time: checkedTime(new Date(fetchedAt).toISOString(), new Date(), t),
      })}
    </span>
  );
}

interface SearchSummaryBarProps {
  query: TeachTableQuery;
}

export function SearchSummaryBar({ query }: SearchSummaryBarProps) {
  const { t, language } = useTranslation();
  const faculties = useStore(searchStore, (state) => state.faculties);
  const departments = useStore(searchStore, (state) => state.departments);
  const curricula = useStore(searchStore, (state) => state.curricula);
  const subjectOwners = useStore(searchStore, (state) => state.subjectOwners);
  const summary = useMemo(
    () =>
      describeQuery(
        query,
        { faculties, departments, curricula, subjectOwners },
        language,
        t,
      ),
    [query, faculties, departments, curricula, subjectOwners, language, t],
  );
  // Each chip is referenced on its own, so the description reads the chips apart.
  const qualifierIds = summary.qualifiers.map(
    (_, index) => `${QUALIFIER_ID_PREFIX}${String(index)}`,
  );
  const formOpen = useStore(searchStore, selectFormOpen);
  const busy = useStore(
    searchStore,
    (state) => state.result.status === 'loading',
  );
  const courses = useStore(searchStore, (state) =>
    state.result.status === 'ready' ? state.result.data.courses.length : null,
  );
  const hasResult = useStore(
    searchStore,
    (state) => state.resultQuery !== null,
  );
  const fetchedAt = useStore(searchStore, (state) =>
    state.result.status === 'ready' ? state.resultFetchedAt : null,
  );
  const TabIcon = TAB_ICON[query.mode];

  return (
    <div
      id={SEARCH_BAR_ID}
      role="region"
      tabIndex={-1}
      aria-label={t('search.bar.label')}
      aria-describedby={[
        SUMMARY_ID,
        TERM_ID,
        ...qualifierIds,
        STATUS_ID,
        ...(fetchedAt === null ? [] : [DATA_TIME_ID]),
      ].join(' ')}
      className={`flex flex-none flex-col gap-1 border-b border-border bg-surface px-4 py-2 ${FOCUS_RING}`}
    >
      {/* Top aligned, so the disclosure stays put when the name grows to two lines
          as the reference lists arrive. */}
      <div className="flex items-start gap-2 text-sm text-ink">
        <TabIcon
          size={16}
          strokeWidth={2}
          aria-hidden
          className="mt-1 shrink-0 text-ink-soft"
        />
        <span
          id={SUMMARY_ID}
          className="line-clamp-2 min-w-0 flex-1 py-0.5 break-words"
        >
          {summary.primary}
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
        <span id={TERM_ID} className={CHIP}>
          {fillTemplate(t('search.summary.term'), {
            semester: query.selected_semester,
            year: query.selected_year,
          })}
        </span>
        {summary.qualifiers.map((qualifier, index) => (
          <span
            key={qualifierIds[index]}
            id={qualifierIds[index]}
            className={CHIP}
          >
            {qualifier}
          </span>
        ))}
        <span id={STATUS_ID}>
          <StatusSlot busy={busy} courses={courses} t={t} />
        </span>
        {fetchedAt === null ? null : <DataTime fetchedAt={fetchedAt} t={t} />}
        {hasResult ? <ResultAction statusId={STATUS_ID} /> : null}
      </div>
    </div>
  );
}
