// The catalog region. It renders exactly one deliberate state for the search
// result: the initial prompt, a loading skeleton, a typed error with one action, an
// empty result carrying the search summary, or the courses. The course rendering
// is filled in by the catalog cards; this panel owns the surrounding states. A retry
// or a refresh replaces its own control with the loading state, so focus moves to the
// summary bar above, which stays in place and reads the busy text.

import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { AlertTriangle, Search, SearchX } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import type { TeachTableQuery } from '@/lib/messaging/protocol';
import type { Translate } from '@/lib/i18n/t';
import { searchStore } from '@/features/search/searchStore';
import { toastStore } from '@/features/shell/toastStore';
import { useSearchDeps } from '@/features/search/SearchDepsContext';
import { useSearchActions } from '@/features/search/useSearchController';
import { errorAction, errorMessageKey } from '@/features/search/errorMessage';
import { SEARCH_BAR_ID, SEARCH_SUBMIT_ID } from '@/features/search/searchIds';
import { commitAndFocus } from '@/features/shell/commitAndFocus';
import { useTranslation } from '@/features/shell/useTranslation';
import { CourseCatalog } from './CourseCatalog';
import { ErrorActionButton } from './ErrorActionButton';
import { InputGuard } from './InputGuard';

function termSummary(query: TeachTableQuery | null, t: Translate): string {
  if (query === null) {
    return '';
  }
  return `${t('search.semester')} ${query.selected_semester}/${query.selected_year}`;
}

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      {[0, 1, 2, 3].map((row) => (
        <div
          key={row}
          className="flex flex-col gap-2 rounded-kcp border border-border p-3"
        >
          <div className="h-4 w-1/2 animate-pulse rounded bg-surface-alt motion-reduce:animate-none" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-surface-alt motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  );
}

/** How long a query may run before the slow notice offers a cancel. The request is
 * not aborted here; only the user's cancel aborts it. */
const SLOW_NOTICE_MS = 8_000;

// Rendered with a key derived from the query, so a new search remounts it and the
// slow timer restarts from zero rather than carrying over the previous query's clock.
function LoadingState({
  t,
  onCancel,
}: {
  t: Translate;
  onCancel: (from: Element) => void;
}) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSlow(true);
    }, SLOW_NOTICE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, []);
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={t('catalog.loading')}
      className="flex flex-col gap-3 p-1"
    >
      {slow ? (
        <div className="flex flex-wrap items-center gap-2 rounded-kcp border border-warn bg-primary-soft px-2 py-1.5 text-xs text-ink">
          <span>{t('catalog.slowNotice')}</span>
          <button
            type="button"
            onClick={(event) => {
              onCancel(event.currentTarget);
            }}
            className="rounded-kcp border border-border bg-surface px-2 py-0.5 text-ink outline-none hover:bg-surface-alt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {t('action.cancel')}
          </button>
        </div>
      ) : null}
      <SkeletonRows />
    </div>
  );
}

/** The course count of the settled search result, or null while there is none, so a
 * header outside the panel can name the result without reading the panel's states. */
export function useResultCourseCount(): number | null {
  return useStore(searchStore, (state) =>
    state.result.status === 'ready' ? state.result.data.courses.length : null,
  );
}

function CatalogState() {
  const deps = useSearchDeps();
  const { retry, refreshResult, cancel } = useSearchActions(deps);
  const { t } = useTranslation();
  const result = useStore(searchStore, (state) => state.result);
  const query = useStore(searchStore, (state) => state.resultQuery);

  if (result.status === 'idle') {
    return (
      <EmptyState
        icon={Search}
        title={t('catalog.emptyTitle')}
        description={t('catalog.emptyBody')}
      />
    );
  }

  if (result.status === 'loading') {
    // The key restarts the slow timer for each distinct query.
    return (
      <LoadingState
        key={query === null ? 'idle' : JSON.stringify(query)}
        t={t}
        onCancel={(from) => {
          // Cancelling reopens the form, so focus moves to its submit, ready to search
          // again; the store write runs before the cancel awaits the worker.
          commitAndFocus(from, SEARCH_SUBMIT_ID, () => {
            void cancel();
          });
        }}
      />
    );
  }

  if (result.status === 'error') {
    return (
      <EmptyState
        icon={AlertTriangle}
        title={t('catalog.errorTitle')}
        description={t(errorMessageKey(result.error))}
        action={
          <ErrorActionButton
            action={errorAction(result.error)}
            t={t}
            onRetry={() => {
              void retry();
            }}
          />
        }
      />
    );
  }

  if (result.data.courses.length === 0) {
    return (
      <EmptyState
        icon={SearchX}
        title={t('catalog.resultEmptyTitle')}
        description={termSummary(query, t)}
      />
    );
  }

  return (
    <CourseCatalog
      catalog={result.data}
      onRefresh={(from) => {
        commitAndFocus(from, SEARCH_BAR_ID, () => {
          void (async () => {
            // A changed result is visible in the catalog; only a no op refresh
            // needs a toast so the action does not feel ignored.
            if ((await refreshResult()) === 'unchanged') {
              toastStore
                .getState()
                .show('success', t('toast.refreshUnchanged'));
            }
          })();
        });
      }}
    />
  );
}

/** The catalog region, guarded against stray pointer input just after a submit. The
 * state renders as the guard's child, so lifting the guard never re-renders it. */
export function CatalogPanel() {
  return (
    <InputGuard>
      <CatalogState />
    </InputGuard>
  );
}
