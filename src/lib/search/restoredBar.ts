// The summary bar a persisted search reopens under after a page reload. The last search
// is folded into its bar, as it was left, so the student sees what they searched and can
// run it again rather than meet the full form. A host result route that names another
// term wins over it: the form opens on the route's term with no bar, since a bar that
// named the other term would describe a search the form no longer holds.

import type { TeachTableQuery } from '@/lib/messaging/protocol';
import { termsEqual, type InitialTerm } from '@/lib/routing/academicTerms';
import type { SearchState } from '@/lib/storage/lastSearch';
import { buildTeachTableQueryForTab } from './formState';

/** The query a persisted search describes, or null when its active tab is incomplete. */
export function persistedBarQuery(
  persisted: SearchState | null,
): TeachTableQuery | null {
  if (persisted === null) return null;
  return buildTeachTableQueryForTab(persisted.activeTab, persisted.term, {
    byClass: persisted.byClass,
    bySubjectId: persisted.bySubjectId,
    byCategory: persisted.byCategory,
  });
}

/** The bar a reload restores, given the term the search was seeded with. */
export function restoredBar(
  persisted: SearchState | null,
  initial: InitialTerm,
): TeachTableQuery | null {
  if (persisted === null) return null;
  if (initial.source === 'route' && !termsEqual(persisted.term, initial.term)) {
    return null;
  }
  return persistedBarQuery(persisted);
}
