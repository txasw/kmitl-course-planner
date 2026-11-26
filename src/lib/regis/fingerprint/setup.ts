// The host code that runs around the page components without being one of them
// (ADR-0079). The store is the one definition built with `new x.y.Store(...)`, and its
// part follows every module, plugin, action, and mutation it takes, since a page
// component that dispatches into it runs that code. The setup is what the module runs
// as it loads: every top level statement, such as a plugin installed with `use`, a
// global mixin, a router guard, and the root Vue instance with the App, its bar, and its
// drawer, and every top level declaration whose value does any of that as it is made.
// The router's route table and its lists of route names are boundaries (routes.ts).

import { text } from './locate.ts';
import type { Boundary, Bundle, ModuleScope, Span } from './module.ts';
import { routeRoots } from './routes.ts';
import { analyseScopes, expressionEnd } from './scopes.ts';

/** The member names that install or change something for every component or route. */
const SETUP_MEMBERS = new Set([
  'mixin',
  'use',
  'directive',
  'component',
  'filter',
  'prototype',
  'beforeEach',
  'beforeResolve',
  'afterEach',
  'onReady',
  'onError',
  'subscribe',
  'subscribeAction',
  'registerModule',
  'watch',
  '$mount',
]);

/** The words after a closing brace that carry on the statement it is in. */
const CARRIES_ON = new Set([
  'else',
  'catch',
  'finally',
  'while',
  'in',
  'instanceof',
]);

export interface ModuleItem {
  /** Whether the item declares a name rather than running a statement. */
  declaration: boolean;
  span: Span;
}

function isOpener(word: string): boolean {
  return word === '{' || word === '(' || word === '[';
}

function isCloser(word: string): boolean {
  return word === '}' || word === ')' || word === ']';
}

/** The end of a function or class declaration that starts at `at`. */
function declarationEnd(bundle: Bundle, at: number, close: number): number {
  let brace = at + 1;
  while (brace < close && text(bundle, brace) !== '{') {
    brace =
      text(bundle, brace) === '('
        ? (bundle.pairs[brace] ?? close) + 1
        : brace + 1;
  }
  return (bundle.pairs[brace] ?? close) + 1;
}

/** The end of a var, let, or const declaration that starts at `at`. */
function variablesEnd(bundle: Bundle, at: number, close: number): number {
  let next = at + 1;
  for (;;) {
    next = isOpener(text(bundle, next))
      ? (bundle.pairs[next] ?? close) + 1
      : next + 1;
    if (text(bundle, next) === '=')
      next = expressionEnd(bundle, next + 1, close);
    if (text(bundle, next) !== ',') return next;
    next += 1;
  }
}

/** The end of a statement that starts at `at`: its semicolon, or what starts the next. */
function statementEnd(bundle: Bundle, at: number, close: number): number {
  let next = at;
  while (next < close) {
    const word = text(bundle, next);
    if (word === ';' || isCloser(word)) return next;
    if (!isOpener(word)) {
      next += 1;
      continue;
    }
    next = (bundle.pairs[next] ?? close) + 1;
    const after = bundle.tokens[next];
    if (word === '{' && after?.kind === 'name' && !CARRIES_ON.has(after.text)) {
      return next;
    }
  }
  return close;
}

/** The module's top level items in order: its declarations and its statements. */
export function moduleItems(bundle: Bundle, module: ModuleScope): ModuleItem[] {
  const close = bundle.pairs[module.body] ?? -1;
  const items: ModuleItem[] = [];
  let at = module.body + 1;
  while (at < close) {
    const word = text(bundle, at);
    if (word === ';') {
      at += 1;
      continue;
    }
    const isAsync = word === 'async' && text(bundle, at + 1) === 'function';
    let end: number;
    let declaration = true;
    if (word === 'function' || word === 'class' || isAsync) {
      end = declarationEnd(bundle, isAsync ? at + 1 : at, close);
    } else if (word === 'var' || word === 'let' || word === 'const') {
      end = variablesEnd(bundle, at, close);
    } else {
      declaration = false;
      end = statementEnd(bundle, at, close);
    }
    // A step that reads nothing is past an unbalanced token; take it alone.
    end = Math.max(end, at + 1);
    items.push({ declaration, span: { start: at, end } });
    at = end;
  }
  return items;
}

/** The store's definition, built with `new x.y.Store(...)`, when there is one alone. */
export function storeSpan(
  module: ModuleScope,
  names: readonly string[],
): Span | null {
  const [name] = names;
  if (names.length !== 1 || name === undefined) return null;
  return module.definitions.get(name) ?? null;
}

/** Whether a declaration's value installs something as the module loads. */
function setsUp(bundle: Bundle, span: Span): boolean {
  const table = analyseScopes(
    bundle.tokens,
    bundle.pairs,
    span.start,
    span.end,
  );
  for (let at = span.start; at < span.end; at += 1) {
    if (
      text(bundle, at - 1) === '.' &&
      SETUP_MEMBERS.has(text(bundle, at)) &&
      !table.nested(at)
    ) {
      return true;
    }
  }
  return false;
}

export interface SetupRoots {
  roots: Span[];
  /** The route table and the route name lists, as boundaries of the setup. */
  boundary: Map<string, string>;
}

/**
 * The spans the setup part reads: each top level statement, each top level declaration
 * that installs something as it is made, and each route entry that names one of the
 * page components KCP depends on, with the route table and the lists of route names it
 * leaves as boundaries.
 */
export function setupRoots(
  bundle: Bundle,
  module: ModuleScope,
  pages: ReadonlySet<string>,
): SetupRoots {
  const roots: Span[] = [];
  for (const { declaration, span } of moduleItems(bundle, module)) {
    if (!declaration) roots.push(span);
    else if (/^(var|let|const)$/.test(text(bundle, span.start))) {
      if (setsUp(bundle, span)) roots.push(span);
    }
  }
  const routes = routeRoots(bundle, module, pages);
  return { roots: [...roots, ...routes.roots], boundary: routes.boundary };
}

/** The setup boundary over the parts' own, for the setup part. */
export function setupBoundary(parts: Boundary, own: SetupRoots): Boundary {
  return new Map([...parts, ...own.boundary]);
}
