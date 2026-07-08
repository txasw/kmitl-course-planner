// The catalog region. It renders exactly one deliberate state for the search
// result: the initial prompt, a loading skeleton, a typed error with retry, an
// empty result carrying the search summary, or the courses. The course rendering
// is filled in by the catalog cards; this panel owns the surrounding states.

import { useStore } from 'zustand';
import { AlertTriangle, Search, SearchX } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import type { TeachTableQuery } from '@/lib/messaging/protocol';
import type { Translate } from '@/lib/i18n/t';
import { searchStore } from '@/features/search/searchStore';
import { useSearchDeps } from '@/features/search/SearchDepsContext';
import { useSearchActions } from '@/features/search/useSearchController';
import { errorMessageKey } from '@/features/search/errorMessage';
import { useTranslation } from '@/features/shell/useTranslation';

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

export function CatalogPanel() {
  const deps = useSearchDeps();
  const { retry } = useSearchActions(deps);
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
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label={t('catalog.loading')}
        className="p-1"
      >
        <SkeletonRows />
      </div>
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
            className="rounded-kcp bg-primary px-3 py-1.5 text-sm font-medium text-surface hover:bg-primary-hover focus:ring-2 focus:ring-primary focus:outline-none"
          >
            {t('action.retry')}
          </button>
        }
      />
    );
  }

  const { courses, duplicateCount } = result.data;
  if (courses.length === 0) {
    return (
      <EmptyState
        icon={SearchX}
        title={t('catalog.resultEmptyTitle')}
        description={termSummary(query, t)}
      />
    );
  }

  const sectionCount = courses.reduce(
    (total, course) => total + course.sections.length,
    0,
  );

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-soft">
        {courses.length} / {sectionCount} / {duplicateCount}
      </p>
      <ul className="flex flex-col gap-2">
        {courses.map((course) => (
          <li
            key={course.subjectId}
            className="rounded-kcp border border-border p-3 text-sm"
          >
            <span className="font-medium text-ink">{course.subjectId}</span>{' '}
            <span className="text-ink-soft">{course.nameTh}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
