// The host router as the setup part reads it (ADR-0079). The route table is a boundary,
// since it names every page and the staff pages change often. The entries that name a
// page component KCP depends on are read in full instead, so a route that moves the pre
// registration page is a change. A list of route names the guard checks a route against
// is a boundary too: what the guard does with it is in the setup part, and the staff
// routes it lists are not.

import { text } from './locate.ts';
import type { Bundle, ModuleScope, Span } from './module.ts';

/** The name a `routes:` key of a router's options names, inside a definition. */
function routeTableName(bundle: Bundle, span: Span): string | null {
  if (text(bundle, span.start) !== 'new') return null;
  for (let at = span.start; at < span.end; at += 1) {
    const value = bundle.tokens[at + 2];
    if (
      text(bundle, at) === 'routes' &&
      text(bundle, at + 1) === ':' &&
      value?.kind === 'name' &&
      (text(bundle, at + 3) === ',' || text(bundle, at + 3) === '}')
    ) {
      return value.text;
    }
  }
  return null;
}

/** The entry objects of a route table, each with its name when it gives one. */
function routeEntries(
  bundle: Bundle,
  table: Span,
): { span: Span; name: string | null; component: string | null }[] {
  if (text(bundle, table.start) !== '[') return [];
  const entries = [];
  for (let at = table.start + 1; at < table.end; at += 1) {
    if (text(bundle, at) !== '{' || bundle.parents[at] !== table.start) {
      continue;
    }
    const end = (bundle.pairs[at] ?? at) + 1;
    let name: string | null = null;
    let component: string | null = null;
    for (let key = at + 1; key < end; key += 1) {
      if (bundle.parents[key] !== at || text(bundle, key + 1) !== ':') continue;
      const value = bundle.tokens[key + 2];
      if (text(bundle, key) === 'name' && value?.kind === 'string')
        name = value.text;
      if (text(bundle, key) === 'component' && value?.kind === 'name')
        component = value.text;
    }
    entries.push({ span: { start: at, end }, name, component });
    at = end - 1;
  }
  return entries;
}

/** A string literal that reads as a route name: a lower case word with underscores. */
const ROUTE_NAME = /^"[a-z][a-z0-9_]*"$/;

/**
 * Whether a definition is a list of route names: a non empty array of route name shaped
 * strings and spreads of other such lists, naming at least one route of the table. The
 * host's lists keep a few names no route has, so not every name must be a route's.
 */
function isRouteNameList(
  bundle: Bundle,
  span: Span,
  routeNames: ReadonlySet<string>,
  lists: ReadonlySet<string>,
): boolean {
  if (
    text(bundle, span.start) !== '[' ||
    bundle.pairs[span.start] !== span.end - 1 ||
    span.end - span.start < 3
  ) {
    return false;
  }
  let routed = false;
  for (let at = span.start + 1; at < span.end - 1; at += 2) {
    const token = bundle.tokens[at];
    if (text(bundle, at) === '...') {
      if (!lists.has(text(bundle, at + 1))) return false;
      routed = true;
      at += 1;
    } else if (token?.kind === 'string' && ROUTE_NAME.test(token.text)) {
      routed ||= routeNames.has(token.text);
    } else return false;
    const after = text(bundle, at + 1);
    if (after !== ',' && at + 1 !== span.end - 1) return false;
  }
  return routed;
}

export interface RouteRoots {
  /** The route entries that name one of the page components KCP depends on. */
  roots: Span[];
  /** The route table and the route name lists, each by its name. */
  boundary: Map<string, string>;
}

/** The route entries the setup reads and the router names it leaves as boundaries. */
export function routeRoots(
  bundle: Bundle,
  module: ModuleScope,
  pages: ReadonlySet<string>,
): RouteRoots {
  const roots: Span[] = [];
  const boundary = new Map<string, string>();
  const routeNames = new Set<string>();
  for (const span of module.definitions.values()) {
    const table = span === null ? null : routeTableName(bundle, span);
    const tableSpan = table === null ? null : module.definitions.get(table);
    if (table === null || tableSpan === undefined || tableSpan === null)
      continue;
    boundary.set(table, 'routes');
    for (const entry of routeEntries(bundle, tableSpan)) {
      if (entry.name !== null) routeNames.add(entry.name);
      if (entry.component !== null && pages.has(entry.component))
        roots.push(entry.span);
    }
  }
  // A list may spread another, so the lists are found until no new one appears.
  const lists = new Set<string>();
  for (let grew = routeNames.size > 0; grew;) {
    grew = false;
    for (const [name, span] of module.definitions) {
      if (span === null || lists.has(name) || boundary.has(name)) continue;
      if (isRouteNameList(bundle, span, routeNames, lists)) {
        lists.add(name);
        boundary.set(name, 'routeNames');
        grew = true;
      }
    }
  }
  return { roots, boundary };
}
