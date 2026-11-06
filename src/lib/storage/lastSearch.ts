// Content owned last search state, persisted so the shared term, the three search
// tabs' fields, and the active tab restore on reopen. It follows the preferences pattern:
// a single blob under its own key, validated on read, resolving to null on a
// corrupt or absent value so the caller falls back to route or generated
// defaults rather than crashing. It is disjoint from the plan root and the worker
// cache, so the plan-store-only persistence rule holds. Version 1 stored a year and
// semester in every tab form; it still loads, taking the active tab's term as the
// shared term, so a returning student keeps the term the last search ran under.

import { z } from 'zod';
import type { StorageAdapter } from './repo';
import { SEARCH_KEY } from './keys';
import {
  SEARCH_TABS,
  categoryFormSchema,
  classFormSchema,
  searchTermSchema,
  subjectIdFormSchema,
} from '../search/formState';

export const searchStateSchema = z.object({
  schemaVersion: z.literal(2),
  activeTab: z.enum(SEARCH_TABS),
  term: searchTermSchema,
  byClass: classFormSchema,
  bySubjectId: subjectIdFormSchema,
  byCategory: categoryFormSchema,
});
export type SearchState = z.infer<typeof searchStateSchema>;

const legacySearchStateSchema = z
  .object({
    schemaVersion: z.literal(1),
    activeTab: z.enum(SEARCH_TABS),
    byClass: classFormSchema.extend(searchTermSchema.shape),
    bySubjectId: subjectIdFormSchema.extend(searchTermSchema.shape),
    byCategory: categoryFormSchema.extend(searchTermSchema.shape),
  })
  .transform((legacy): SearchState => {
    const tabForms = {
      by_class: legacy.byClass,
      by_subject_id: legacy.bySubjectId,
      by_subject_owner_id: legacy.byCategory,
    };
    const active = tabForms[legacy.activeTab];
    // Parsing through the current form schemas drops the per tab term fields.
    return {
      schemaVersion: 2,
      activeTab: legacy.activeTab,
      term: { year: active.year, semester: active.semester },
      byClass: classFormSchema.parse(legacy.byClass),
      bySubjectId: subjectIdFormSchema.parse(legacy.bySubjectId),
      byCategory: categoryFormSchema.parse(legacy.byCategory),
    };
  });

const storedSearchStateSchema = z.union([
  searchStateSchema,
  legacySearchStateSchema,
]);

export interface SearchStateRepository {
  load(): Promise<SearchState | null>;
  save(state: SearchState): Promise<void>;
}

export function createSearchStateRepository(
  adapter: StorageAdapter,
): SearchStateRepository {
  return {
    async load() {
      const parsed = storedSearchStateSchema.safeParse(
        await adapter.get(SEARCH_KEY),
      );
      return parsed.success ? parsed.data : null;
    },
    async save(state) {
      await adapter.set(SEARCH_KEY, state);
    },
  };
}
