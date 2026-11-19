// The query chip the search form folds into once a user search starts. The whole chip is
// the one control that reopens the form: it names what was searched in full, wrapping
// rather than clamping, over a line with the term and the scope, and a pencil tile says
// it can be edited. Its accessible name starts with the edit action and carries the
// visible summary, so a voice command that speaks what the chip shows reaches it. While
// the query runs the scope line ends in the busy text, so the press is visibly accepted
// even when a cached answer changes nothing else. The course count is not repeated here,
// because the catalog summary line under the filters carries it once.
// The refresh beside the chip says when the data on screen was fetched in its tooltip
// and description. Past the cache lifetime that time also shows as a warn line under the
// chip, with a warning sign so the cue does not rest on colour alone, since that is the
// moment the refresh is worth pressing.
// The chip row is a focusable region, not a live region: the busy text is read when
// focus lands on it, and settled outcomes stay with the panel's existing announcers. The
// chip keeps one name while it toggles and reports its state through aria-expanded, so
// it never moves under the pointer.

import { useMemo } from 'react';
import { useStore } from 'zustand';
import { AlertTriangle, ChevronUp, LoaderCircle, Pencil } from 'lucide-react';
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

const EDIT_ID = 'kcp-search-bar-edit';
const SUMMARY_ID = 'kcp-search-bar-summary';
const TERM_ID = 'kcp-search-bar-term';
const STATUS_ID = 'kcp-search-bar-status';
const DATA_TIME_ID = 'kcp-search-bar-data-time';
const QUALIFIER_ID_PREFIX = 'kcp-search-bar-qualifier-';

function BusyText({ t }: { t: Translate }) {
  // The spinner stops after eight turns, about when the slow notice takes over, and is
  // a static icon under reduced motion.
  return (
    <span className="kcp-fade-in inline-flex items-center gap-1">
      <LoaderCircle
        size={12}
        strokeWidth={2}
        aria-hidden
        className="animate-spin [animation-iteration-count:8] motion-reduce:animate-none"
      />
      {t('search.loading')}
    </span>
  );
}

interface DataTimeProps {
  text: string;
  stale: boolean;
}

// How old the courses on screen are. Fresh, it is read through the refresh's tooltip and
// description only; stale, it shows as a warn line, because a search would fetch again.
function DataTime({ text, stale }: DataTimeProps) {
  return (
    <p
      id={DATA_TIME_ID}
      data-stale={stale ? 'true' : 'false'}
      className={
        stale
          ? 'flex items-center gap-1 px-1 text-xs text-warn tabular-nums'
          : 'sr-only'
      }
    >
      {stale ? (
        <AlertTriangle
          size={12}
          strokeWidth={2}
          aria-hidden
          className="shrink-0"
        />
      ) : null}
      <span>{text}</span>
    </p>
  );
}

/** The clock time of the fetch behind the courses, or null before one settles. */
function useDataTime(t: Translate): { text: string; stale: boolean } | null {
  const fetchedAt = useStore(searchStore, (state) =>
    state.result.status === 'ready' ? state.resultFetchedAt : null,
  );
  const stale = useIsPast(
    fetchedAt === null ? null : fetchedAt + TEACH_TABLE_TTL_MS,
  );
  if (fetchedAt === null) return null;
  return {
    text: fillTemplate(t('search.bar.dataAsOf'), {
      time: checkedTime(new Date(fetchedAt).toISOString(), new Date(), t),
    }),
    stale,
  };
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
  // Each qualifier is referenced on its own, so the name reads them apart.
  const qualifierIds = summary.qualifiers.map(
    (_, index) => `${QUALIFIER_ID_PREFIX}${String(index)}`,
  );
  const formOpen = useStore(searchStore, selectFormOpen);
  const busy = useStore(
    searchStore,
    (state) => state.result.status === 'loading',
  );
  const dataTime = useDataTime(t);
  const TabIcon = TAB_ICON[query.mode];
  const TrailIcon = formOpen ? ChevronUp : Pencil;
  const queryIds = [SUMMARY_ID, TERM_ID, ...qualifierIds];

  return (
    <div
      id={SEARCH_BAR_ID}
      role="region"
      tabIndex={-1}
      aria-label={t('search.bar.label')}
      aria-describedby={[
        ...queryIds,
        STATUS_ID,
        ...(dataTime === null ? [] : [DATA_TIME_ID]),
      ].join(' ')}
      className={`flex flex-none flex-col gap-1 border-b border-border bg-surface px-3 py-2 ${FOCUS_RING}`}
    >
      <div className="flex items-center gap-1">
        <button
          id={SEARCH_DISCLOSURE_ID}
          type="button"
          aria-expanded={formOpen}
          aria-controls={SEARCH_FORM_ID}
          aria-labelledby={[EDIT_ID, ...queryIds].join(' ')}
          onClick={(event) => {
            // The second click of a double click would close the form it just opened.
            if (event.detail > 1) {
              return;
            }
            searchStore.getState().setSearchFormOpen(!formOpen);
          }}
          className={`kcp-soft-card flex min-h-11 min-w-0 flex-1 items-center gap-2.5 py-1 pr-1.5 pl-2 text-left text-ink hover:[--kcp-tint:var(--kcp-ink-soft)] ${FOCUS_RING}`}
        >
          <span id={EDIT_ID} className="sr-only">
            {t('search.bar.edit')}
          </span>
          <TabIcon
            size={18}
            strokeWidth={2}
            aria-hidden
            className="shrink-0 text-ink-soft"
          />
          <span className="flex min-w-0 flex-1 flex-col">
            <span id={SUMMARY_ID} className="text-sm font-semibold break-words">
              {summary.primary}
            </span>
            <span className="flex flex-wrap items-center gap-x-2.5 text-xs text-ink-soft">
              <span id={TERM_ID} className="tabular-nums">
                {fillTemplate(t('search.summary.term'), {
                  semester: query.selected_semester,
                  year: query.selected_year,
                })}
              </span>
              {summary.qualifiers.map((qualifier, index) => (
                <span key={qualifierIds[index]} id={qualifierIds[index]}>
                  {qualifier}
                </span>
              ))}
              <span id={STATUS_ID}>{busy ? <BusyText t={t} /> : null}</span>
            </span>
          </span>
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-kcp-sm bg-surface-sunken text-ink"
          >
            <TrailIcon size={16} strokeWidth={2} />
          </span>
        </button>
        <ResultAction
          statusId={STATUS_ID}
          dataTime={dataTime === null ? null : dataTime.text}
          dataTimeId={DATA_TIME_ID}
        />
      </div>
      {dataTime === null ? null : (
        <DataTime text={dataTime.text} stale={dataTime.stale} />
      )}
    </div>
  );
}
