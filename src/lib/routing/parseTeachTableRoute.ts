// Parse the host application's hash route. The site is a hash routed single page
// application: the search page is #/teach_table_selector and the result page is
// #/teach_table?mode=...&selected_year=...&selected_semester=... . Arriving on a
// result route is a strong signal of the year and semester the student is looking
// at, so the search form seeds its term from these params. Only the result route
// carries params; the selector route and every other route resolve to null.

export interface TeachTableRoute {
  /** The query params carried by a #/teach_table result route. */
  params: Record<string, string>;
}

/**
 * Parse a location hash into the teach table result route params, or null when
 * the hash is not a #/teach_table result route. The selector route
 * (#/teach_table_selector) and any nested path resolve to null because they
 * carry no term to seed from.
 */
export function parseTeachTableRoute(hash: string): TeachTableRoute | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const queryStart = raw.indexOf('?');
  const path = queryStart === -1 ? raw : raw.slice(0, queryStart);
  if (path !== '/teach_table' || queryStart === -1) {
    return null;
  }
  const search = new URLSearchParams(raw.slice(queryStart + 1));
  const params: Record<string, string> = {};
  for (const [key, value] of search) {
    params[key] = value;
  }
  return { params };
}
