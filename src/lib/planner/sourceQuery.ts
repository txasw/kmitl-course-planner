// Convert a teach table query into the source query stored on a plan entry. The
// boolean search_all_* flags are stringified and any omitted optional select is
// dropped, so the stored params are a flat string map that revalidation can replay
// verbatim to reproduce the exact search that produced a section.

import {
  teachTableQuerySchema,
  type TeachTableQuery,
} from '../messaging/protocol';
import type { SourceQuery } from '../domain/plan';
import { termFromQueryFields, type Term } from '../routing/academicTerms';

// The query flags stored as string booleans, coerced back by key on replay so a
// select whose value happens to be "true" is never mistaken for a flag.
const BOOLEAN_KEYS = new Set([
  'search_all_faculty',
  'search_all_department',
  'search_all_curriculum',
  'search_all_class_year',
]);

export function toSourceQuery(query: TeachTableQuery): SourceQuery {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) {
      continue;
    }
    params[key] = typeof value === 'boolean' ? String(value) : value;
  }
  return { endpoint: 'get-teach-table-show', params };
}

/**
 * Rebuild a teach table query from stored source query params so revalidation can
 * replay the exact search. It reverses toSourceQuery: the search_all_* flags return
 * to booleans by key, the other fields pass through as strings, and the result is
 * validated. Params that do not form a valid query, such as an empty map, yield null.
 */
export function sourceQueryToQuery(
  params: Record<string, string>,
): TeachTableQuery | null {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    raw[key] = BOOLEAN_KEYS.has(key) ? value === 'true' : value;
  }
  const result = teachTableQuerySchema.safeParse(raw);
  return result.success ? result.data : null;
}

/**
 * The academic term a stored source query targeted, read from its flat params, or
 * null when the year is missing or the semester is not a real one. Callers treat
 * null as a term that matches no plan, so a malformed source query is never added.
 */
export function termFromSourceQueryParams(
  params: Record<string, string>,
): Term | null {
  return termFromQueryFields(params.selected_year, params.selected_semester);
}
