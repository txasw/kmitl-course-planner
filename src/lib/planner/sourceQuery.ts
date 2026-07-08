// Convert a teach table query into the source query stored on a plan entry. The
// boolean search_all_* flags are stringified and any omitted optional select is
// dropped, so the stored params are a flat string map that revalidation can replay
// verbatim to reproduce the exact search that produced a section.

import type { TeachTableQuery } from '../messaging/protocol';
import type { SourceQuery } from '../domain/plan';

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
