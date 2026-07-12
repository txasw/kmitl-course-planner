// The catalog region. It renders exactly one deliberate state for the search
// result: the initial prompt, a loading skeleton, a typed error with retry, an
// empty result carrying the search summary, or the courses. The course rendering
// is filled in by the catalog cards; this panel owns the surrounding states.

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
import { errorMessageKey } from '@/features/search/errorMessage';
import { useTranslation } from '@/features/shell/useTranslation';
import { FOCUS_OUTLINE } from '@/lib/ui/focus';
import { CourseCatalog } from './CourseCatalog';

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
function LoadingState({ t, onCancel }: { t: Translate; onCancel: () => void }) {
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
            onClick={onCancel}
            className="rounded-kcp border border-border bg-surface px-2 py-0.5 font-medium text-ink outline-none hover:bg-surface-alt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {t('action.cancel')}
          </button>
        </div>
      ) : null}
      <SkeletonRows />
    </div>
  );
}

export function CatalogPanel() {
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
        onCancel={() => {
          void cancel();
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
          <button
            type="button"
            onClick={() => {
              void retry();
            }}
            className={`rounded-kcp bg-primary-strong px-3 py-1.5 text-sm font-medium text-surface hover:bg-primary-hover ${FOCUS_OUTLINE}`}
          >
            {t('action.retry')}
          </button>
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
      onRefresh={() => {
        void (async () => {
          // A changed result is visible in the catalog; only a no op refresh
          // needs a toast so the action does not feel ignored.
          if ((await refreshResult()) === 'unchanged') {
            toastStore.getState().show('success', t('toast.refreshUnchanged'));
          }
        })();
      }}
    />
  );
}
