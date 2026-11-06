// The one persistent status region for settled search outcomes, listed in the live
// region inventory of ADR-0048. It sits in Layout, outside the catalog column, so it
// stays mounted while the column swaps its loading, error, empty and result states, and
// while a sheet or a hidden docked column keeps the result out of view. It speaks only
// when a user search settles: the course and section count, the empty title with the
// searched term, or the error title. A retry pressed on the error state is the student
// asking again after an outcome that was spoken, so its settle is spoken too. A refresh
// replaces the result without a word, and a re-render or a language change says
// nothing, because the message is written at the settle rather than derived from the
// current state. Each settle replaces the message node, so a repeated search that
// settles on the same words is still read once, and any new run clears the region while
// it runs.

import { useEffect, useRef, useState } from 'react';
import type { NormalizedCatalog } from '@/lib/domain/normalize';
import type { Translate } from '@/lib/i18n/t';
import { fillTemplate } from '@/lib/i18n/template';
import type { TeachTableQuery } from '@/lib/messaging/protocol';
import type { AsyncState } from '@/lib/utils/async';
import { countSections } from '@/lib/catalog/countSections';
import { termSummary } from '@/features/catalog/CatalogPanel';
import { searchStore } from '@/features/search/searchStore';
import { useTranslation } from './useTranslation';

interface Announcement {
  id: number;
  text: string;
}

/** What a settled result says, or null for a state that is not an outcome. */
function outcomeText(
  result: AsyncState<NormalizedCatalog>,
  query: TeachTableQuery | null,
  t: Translate,
): string | null {
  if (result.status === 'error') {
    return t('catalog.errorTitle');
  }
  if (result.status !== 'ready') {
    return null;
  }
  const { courses } = result.data;
  if (courses.length === 0) {
    return `${t('catalog.resultEmptyTitle')} ${termSummary(query, t)}`;
  }
  return fillTemplate(t('status.resultsFound'), {
    courses: courses.length,
    sections: countSections(courses),
  });
}

export function StatusAnnouncer() {
  const { t } = useTranslation();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  // Whether the run in flight started from an error, which only the retry action does.
  const retrying = useRef(false);

  useEffect(
    () =>
      searchStore.subscribe((state, previous) => {
        if (state.result === previous.result) {
          return;
        }
        if (state.result.status === 'loading') {
          // Any new run clears the last outcome, so the region never holds a stale
          // count or error while the result is replaced. A removal is not read.
          setAnnouncement(null);
          retrying.current = previous.result.status === 'error';
          return;
        }
        if (
          previous.result.status !== 'loading' ||
          (state.resultIntent !== 'user' && !retrying.current)
        ) {
          return;
        }
        const text = outcomeText(state.result, state.resultQuery, t);
        if (text !== null) {
          setAnnouncement((current) => ({
            id: (current?.id ?? 0) + 1,
            text,
          }));
        }
      }),
    [t],
  );

  return (
    <div role="status" className="sr-only">
      {announcement === null ? null : (
        <span key={announcement.id}>{announcement.text}</span>
      )}
    </div>
  );
}
