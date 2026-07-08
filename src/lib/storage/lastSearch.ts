// Content owned last search state, persisted so the three search tabs restore
// their fields and the active tab on reopen. It follows the preferences pattern:
// a single blob under its own key, validated on read, resolving to null on a
// corrupt or absent value so the caller falls back to route or generated
// defaults rather than crashing. It is disjoint from the plan root and the worker
// cache, so the plan-store-only persistence rule holds.

import { z } from 'zod';
import type { StorageAdapter } from './repo';
import { SEARCH_KEY } from './keys';
import {
  SEARCH_TABS,
  categoryFormSchema,
  classFormSchema,
  subjectIdFormSchema,
} from '../search/formState';

export const searchStateSchema = z.object({
  schemaVersion: z.literal(1),
  activeTab: z.enum(SEARCH_TABS),
  byClass: classFormSchema,
  bySubjectId: subjectIdFormSchema,
  byCategory: categoryFormSchema,
});
export type SearchState = z.infer<typeof searchStateSchema>;

export interface SearchStateRepository {
  load(): Promise<SearchState | null>;
  save(state: SearchState): Promise<void>;
}

export function createSearchStateRepository(
  adapter: StorageAdapter,
): SearchStateRepository {
  return {
    async load() {
      const parsed = searchStateSchema.safeParse(await adapter.get(SEARCH_KEY));
      return parsed.success ? parsed.data : null;
    },
    async save(state) {
      await adapter.set(SEARCH_KEY, state);
    },
  };
}
