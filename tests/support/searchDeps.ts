// A fake of the injected search dependencies for component tests. By default the
// send and the repository load never resolve, so shell tests that only render the
// overlay do not trigger post render store updates. Search specific tests pass
// their own resolving fakes through the overrides.

import type { SearchDeps } from '@/features/search/SearchDepsContext';
import type { TeachTableResult } from '@/lib/api/types';
import type { NormalizedCatalog } from '@/lib/domain/normalize';
import type { TypedSend } from '@/lib/messaging/sendTyped';
import type { SearchState } from '@/lib/storage/lastSearch';

/** The worker's teach table answer for a catalog, fetched at the given time. */
export function teachTableResult(
  catalog: NormalizedCatalog,
  fetchedAt = 0,
): TeachTableResult {
  return { catalog, fetchedAt };
}

export function fakeSearchDeps(
  overrides: Partial<SearchDeps> = {},
): SearchDeps {
  // A single arrow cannot satisfy the generic send signature, so the never
  // resolving stub is cast once here for tests.
  const send = (() => new Promise(() => undefined)) as unknown as TypedSend;
  return {
    send,
    repo: {
      load: () => new Promise<SearchState | null>(() => undefined),
      save: () => Promise.resolve(),
    },
    ...overrides,
  };
}
