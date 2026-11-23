// The sanitized form of the host location hash, the only form of the address KCP keeps
// (ADR-0075). The host can carry identity or a credential in its hash, such as a token
// after a sign in, a student id on an officer page, or the fields a sign in redirect
// appends, so a raw hash must never reach a store, a log, or the DOM. KCP needs only two
// things from the address: which page is on screen, and on the course result page the
// search it shows, which seeds the planner's own search. The sanitized hash keeps the
// route path and, on that result page alone, the teach table search fields, and drops
// everything else at the point it is read.

import { teachTableQuerySchema } from '../messaging/protocol';

/** The host course result route, whose search fields KCP reads. */
const RESULT_PATH = '/teach_table';

/** The search fields a result route may carry, taken from the query every mode sends. */
const RESULT_FIELDS: ReadonlySet<string> = new Set(
  teachTableQuerySchema.options.flatMap((mode) => Object.keys(mode.shape)),
);

// A route path is a slash followed by the characters the host route names use. The
// match stops at the first other character, so a query, or a sign in redirect that
// appends its fields after an ampersand, is never part of the path.
const ROUTE_PATH = /^\/[A-Za-z0-9_/-]*/;

/** The route path a location hash names, or an empty string when it names none. */
export function routePath(hash: string): string {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  return ROUTE_PATH.exec(raw)?.[0] ?? '';
}

/**
 * The location hash reduced to its route path, plus the teach table search fields on
 * the result route. A hash that names no route reduces to an empty string, as an
 * absent hash reads.
 */
export function sanitizeHash(hash: string): string {
  const path = routePath(hash);
  if (path === '') {
    return '';
  }
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (path !== RESULT_PATH || raw[path.length] !== '?') {
    return `#${path}`;
  }
  const kept = new URLSearchParams();
  for (const [key, value] of new URLSearchParams(raw.slice(path.length + 1))) {
    if (RESULT_FIELDS.has(key)) {
      kept.append(key, value);
    }
  }
  return `#${path}?${kept.toString()}`;
}
