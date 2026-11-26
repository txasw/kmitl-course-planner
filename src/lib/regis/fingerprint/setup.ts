// The host code that runs around the page components without being one of them
// (ADR-0079). The store is the one definition built with `new x.y.Store(...)`, and its
// part follows every module, plugin, action, and mutation it takes, since a page
// component that dispatches into it runs that code. The setup is what the module runs
// as it loads: every top level statement, such as a plugin installed with `use`, a
// global mixin, a router guard, and the root Vue instance with the App, its bar, and its
// drawer, and every top level declaration whose value does anything as it is made: one
// that installs something for every component or route, or that makes a call, a `new`,
// or a write outside the functions it defines (effects.ts). The router's route table and
// its lists of route names are boundaries (routes.ts), and so are the drawer's menu and
// its scoped style id (shell.ts).

import { makesEffect, requireName, type EffectContext } from './effects.ts';
import { clientSpan, storeNames, text } from './locate.ts';
import type {
  Boundary,
  Bundle,
  ModuleScope,
  Replacement,
  Span,
} from './module.ts';
import { routeRoots } from './routes.ts';
import { analyseScopes, expressionEnd } from './scopes.ts';
import { appBinder, shellReplacements } from './shell.ts';

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

export interface Declarator {
  /** The name or the pattern it binds, through its value. */
  span: Span;
  /** The index of its `=`, or -1 when it has no value. */
  equals: number;
}

/** The declarators of a var, let, or const declaration that starts at `at`. */
function declarators(bundle: Bundle, at: number, close: number): Declarator[] {
  const found: Declarator[] = [];
  let next = at + 1;
  for (;;) {
    const start = next;
    next = isOpener(text(bundle, next))
      ? (bundle.pairs[next] ?? close) + 1
      : next + 1;
    let equals = -1;
    if (text(bundle, next) === '=') {
      equals = next;
      next = expressionEnd(bundle, next + 1, close);
    }
    found.push({ span: { start, end: next }, equals });
    if (text(bundle, next) !== ',') return found;
    next += 1;
  }
}

/** The end of a var, let, or const declaration that starts at `at`. */
function variablesEnd(bundle: Bundle, at: number, close: number): number {
  return declarators(bundle, at, close).at(-1)?.span.end ?? at + 1;
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

/** Whether a span reaches a member that installs something for every component or route. */
function installs(bundle: Bundle, span: Span): boolean {
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

/** Whether a declarator binds a pattern, such as `{a:b}=c`, rather than one name. */
function isPattern(bundle: Bundle, declarator: Declarator): boolean {
  return isOpener(text(bundle, declarator.span.start));
}

/**
 * The declarators of a declaration that do anything as the module loads: install
 * something for every component or route, or make an effect (effects.ts). Each is read
 * alone, so a declaration that also builds a service or a staff page reads only what
 * runs: its value, or the whole declarator when it binds a pattern.
 */
function runningDeclarators(context: EffectContext, span: Span): Declarator[] {
  const { bundle } = context;
  return declarators(bundle, span.start, span.end).filter(
    (declarator) =>
      declarator.equals >= 0 &&
      (installs(bundle, declarator.span) ||
        makesEffect(context, declarator.span, {
          skip: new Set([declarator.equals]),
        })),
  );
}

/** The words before and after a name that a pattern binds, such as `b` in `{a:b}=c`. */
const BOUND_BEFORE = new Set(['{', ',', ':', '[', '...']);
const BOUND_AFTER = new Set(['}', ',', ']', '=']);

/** The index of each name a pattern declarator binds, such as `b` in `{a:b}=c`. */
function patternBindings(bundle: Bundle, declarator: Declarator): number[] {
  const bound: number[] = [];
  for (let at = declarator.span.start; at < declarator.equals; at += 1) {
    if (
      bundle.tokens[at]?.kind === 'name' &&
      BOUND_BEFORE.has(text(bundle, at - 1)) &&
      BOUND_AFTER.has(text(bundle, at + 1))
    ) {
      bound.push(at);
    }
  }
  return bound;
}

export interface SetupRoots {
  roots: Span[];
  /** The route table and the route name lists, as boundaries of the setup. */
  boundary: Map<string, string>;
  /** The App shell's data literals and scoped style ids, each written as one word. */
  replacements: Map<number, Replacement>;
}

/**
 * The spans the setup part reads: each top level statement, each top level declaration
 * that installs something as it is made, and each route entry that names one of the
 * page components KCP depends on, with the route table and the lists of route names it
 * leaves as boundaries, and the App shell's data literals it writes as one word each.
 */
export function setupRoots(
  bundle: Bundle,
  module: ModuleScope,
  pages: ReadonlySet<string>,
): SetupRoots {
  const items = moduleItems(bundle, module);
  const variables = items.filter(
    ({ declaration, span }) =>
      declaration && /^(var|let|const)$/.test(text(bundle, span.start)),
  );
  const context: EffectContext = {
    bundle,
    module,
    require: requireName(bundle, module),
    binder: appBinder(bundle, module),
    client: clientSpan(bundle, module),
    helpers: new Set(),
  };
  // A name a running pattern binds is a helper the setup reads where it is made, such as
  // `{mapFields:b}=(0,x.y)({...})`, so a call to it is no effect of its own.
  const helpers = new Set<string>();
  for (const { span } of variables) {
    for (const declarator of runningDeclarators(context, span)) {
      if (isPattern(bundle, declarator)) {
        for (const at of patternBindings(bundle, declarator))
          helpers.add(text(bundle, at));
      }
    }
  }
  context.helpers = helpers;
  const store = storeSpan(module, storeNames(bundle, module));
  const bound = new Map<number, Replacement>();
  const roots: Span[] = items
    .filter(({ declaration }) => !declaration)
    .map(({ span }) => span);
  for (const { span } of variables) {
    for (const declarator of runningDeclarators(context, span)) {
      const value = {
        start: declarator.equals + 1,
        end: declarator.span.end,
      };
      // The store's definition is the store part, which the setup names and leaves.
      if (value.start === store?.start) continue;
      if (!isPattern(bundle, declarator)) {
        roots.push(value);
        continue;
      }
      // A name a pattern binds is no module definition, so it would read as its minified
      // letters; it is written as one word, and the pattern's keys and defaults stay.
      roots.push(declarator.span);
      for (const at of patternBindings(bundle, declarator))
        bound.set(at, { word: '@bound', end: at + 1 });
    }
  }
  const routes = routeRoots(bundle, module, pages);
  return {
    roots: [...roots, ...routes.roots],
    boundary: routes.boundary,
    replacements: new Map([...shellReplacements(bundle, module), ...bound]),
  };
}

/** The setup boundary over the parts' own, for the setup part. */
export function setupBoundary(parts: Boundary, own: SetupRoots): Boundary {
  return new Map([...parts, ...own.boundary]);
}
