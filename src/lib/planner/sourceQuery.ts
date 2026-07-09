// Convert a teach table query into the source query stored on a plan entry. The
// boolean search_all_* flags are stringified and any omitted optional select is
// dropped, so the stored params are a flat string map that revalidation can replay
// verbatim to reproduce the exact search that produced a section.

import type { TeachTableQuery } from '../messaging/protocol';
import type { SourceQuery } from '../domain/plan';
import type { Semester, Term } from '../routing/academicTerms';

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

function asSemester(value: string | undefined): Semester {
  return value === '1' || value === '2' || value === '3' ? value : '1';
}

/**
 * The academic term a stored source query targeted, read from its flat params. Every
 * real teach table query carries both fields, so the defaults only guard a degenerate
 * empty map, which the entry path stops producing once the source query is required.
 */
export function termFromSourceQueryParams(
  params: Record<string, string>,
): Term {
  return {
    year: params.selected_year ?? '',
    semester: asSemester(params.selected_semester),
  };
}
