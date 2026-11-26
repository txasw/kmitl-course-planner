// Whether code does something as the module loads (ADR-0079, amendment of 2026-11-27): a
// call, a `new`, a tagged template, an assignment, an update, or a delete outside the
// functions it defines, which run only when called. The setup part reads every top level
// declaration whose value does any of that, so a hook a declaration installs, such as a
// document listener or a request made in a comma expression, is a change. Three shapes the
// build writes around every component do nothing of the kind and are left out: a webpack
// require `r(<number>)` on the module function's require parameter, the call that binds a
// component, `(0,x.y)(...)` on the binding the App is bound with, and `new C` of a class
// whose construction runs nothing but a `super(...)` up to the API client, which the
// client part reads. Every other call and `new` counts.

import { text } from './locate.ts';
import type { Bundle, ModuleScope, Span } from './module.ts';
import { analyseScopes, isPropertyName } from './scopes.ts';

/** How many classes a `new` is followed up through, and aliases through each. */
const CHAIN_LIMIT = 8;

/** The words before a parenthesis that make it no call. */
const NOT_CALLEE = new Set([
  'await',
  'case',
  'catch',
  'delete',
  'do',
  'else',
  'for',
  'function',
  'if',
  'in',
  'instanceof',
  'of',
  'return',
  'switch',
  'throw',
  'typeof',
  'void',
  'while',
  'with',
  'yield',
]);

/** The operators that write to what they name. */
const WRITES = new Set([
  '=',
  '+=',
  '-=',
  '*=',
  '/=',
  '%=',
  '**=',
  '<<=',
  '>>=',
  '>>>=',
  '&=',
  '|=',
  '^=',
  '&&=',
  '||=',
  '??=',
  '++',
  '--',
  'delete',
]);

export interface EffectContext {
  bundle: Bundle;
  module: ModuleScope;
  /** The module function's require parameter, or null. */
  require: string | null;
  /** The `x.y` the App component is bound with, as `(0,x.y)(...)`, or null. */
  binder: string | null;
  /** The API client class, which the client part reads, or null. */
  client: Span | null;
  /** Names the setup reads where they are made, so a call to one is no effect. */
  helpers: ReadonlySet<string>;
}

/** The module function's third parameter, which webpack passes as its require. */
export function requireName(
  bundle: Bundle,
  module: ModuleScope,
): string | null {
  if (text(bundle, module.body - 1) !== ')') return null;
  const open = bundle.pairs[module.body - 1] ?? -1;
  const names: string[] = [];
  for (let at = open + 1; at < module.body - 1; at += 1) {
    if (bundle.tokens[at]?.kind === 'name') names.push(text(bundle, at));
    else if (text(bundle, at) !== ',') return null;
  }
  return names.length === 3 ? (names[2] ?? null) : null;
}

/** A definition followed through plain aliases such as `a=b`. */
function resolved(context: EffectContext, name: string): Span | null {
  const { bundle, module } = context;
  let span = module.definitions.get(name) ?? null;
  for (let step = 0; step < CHAIN_LIMIT && span !== null; step += 1) {
    const single =
      span.end - span.start === 1 && bundle.tokens[span.start]?.kind === 'name';
    if (!single) return span;
    span = module.definitions.get(text(bundle, span.start)) ?? null;
  }
  return null;
}

/** Whether the parenthesis at `at` calls what is before it. */
function isCall(bundle: Bundle, at: number): boolean {
  if (text(bundle, at) !== '(' || bundle.tokens[at]?.kind !== 'punct')
    return false;
  const before = bundle.tokens[at - 1];
  if (before === undefined) return false;
  if (before.kind === 'name') return !NOT_CALLEE.has(before.text);
  if (before.kind === 'punct')
    return before.text === ')' || before.text === ']' || before.text === '}';
  return before.kind !== 'number' && before.kind !== 'regex';
}

/**
 * Whether the call at `at` is webpack's own: a require of a module by its number,
 * `r(<number>)`, or the default export getter `r.n(<name>)`.
 */
function isRequire(context: EffectContext, at: number): boolean {
  const { bundle, require } = context;
  if (require === null || text(bundle, at + 2) !== ')') return false;
  const argument = bundle.tokens[at + 1]?.kind;
  const direct =
    text(bundle, at - 1) === require &&
    text(bundle, at - 2) !== '.' &&
    argument === 'number';
  const getter =
    text(bundle, at - 1) === 'n' &&
    text(bundle, at - 2) === '.' &&
    text(bundle, at - 3) === require &&
    text(bundle, at - 4) !== '.' &&
    argument === 'name';
  return direct || getter;
}

/** Whether the call at `at` calls a helper the setup reads where it is made. */
function isHelper(context: EffectContext, at: number): boolean {
  const { bundle } = context;
  return (
    bundle.tokens[at - 1]?.kind === 'name' &&
    text(bundle, at - 2) !== '.' &&
    context.helpers.has(text(bundle, at - 1))
  );
}

/** Whether the call at `at` is `(0,x.y)(` on the binding the App is bound with. */
function isBinding(context: EffectContext, at: number): boolean {
  const { bundle, binder } = context;
  if (binder === null || text(bundle, at - 1) !== ')') return false;
  const open = bundle.pairs[at - 1] ?? -1;
  return (
    open === at - 7 &&
    text(bundle, open + 1) === '0' &&
    text(bundle, open + 2) === ',' &&
    `${text(bundle, open + 3)}.${text(bundle, open + 5)}` === binder &&
    text(bundle, open + 4) === '.'
  );
}

/**
 * Whether constructing the class `name` runs nothing but a `super(...)` up to the API
 * client: no field and no static member, and a constructor, if it has one, that takes
 * plain parameters and whose body makes no effect but that one call.
 */
function constructsQuietly(
  context: EffectContext,
  name: string,
  depth: number,
): boolean {
  const { bundle } = context;
  const span = resolved(context, name);
  if (span === null || depth > CHAIN_LIMIT) return false;
  if (span.start === context.client?.start) return true;
  if (text(bundle, span.start) !== 'class') return false;
  let at = span.start + 1;
  if (bundle.tokens[at]?.kind === 'name' && text(bundle, at) !== 'extends')
    at += 1;
  let parent: string | null = null;
  if (text(bundle, at) === 'extends') {
    if (bundle.tokens[at + 1]?.kind !== 'name') return false;
    parent = text(bundle, at + 1);
    at += 2;
  }
  if (text(bundle, at) !== '{') return false;
  const close = bundle.pairs[at] ?? -1;
  for (let member = at + 1; member < close; member += 1) {
    if (bundle.parents[member] !== at) continue;
    const word = text(bundle, member);
    if (word === '=' || word === 'static') return false;
    if (word !== 'constructor' || text(bundle, member + 1) !== '(') continue;
    const params = member + 1;
    const body = (bundle.pairs[params] ?? params) + 1;
    for (let param = params + 1; param < body - 1; param += 1) {
      const plain =
        bundle.tokens[param]?.kind === 'name' || text(bundle, param) === ',';
      if (!plain) return false;
    }
    const end = (bundle.pairs[body] ?? body) + 1;
    if (
      makesEffect(context, { start: body, end }, { superCall: parent !== null })
    )
      return false;
  }
  return parent === null || constructsQuietly(context, parent, depth + 1);
}

/** Whether the `new` at `at` constructs a named class that runs nothing as it is made. */
function isQuietNew(context: EffectContext, at: number): boolean {
  const { bundle } = context;
  const name = bundle.tokens[at + 1];
  const after = text(bundle, at + 2);
  return (
    name?.kind === 'name' &&
    after !== '.' &&
    after !== '[' &&
    after !== '?.' &&
    constructsQuietly(context, name.text, 0)
  );
}

export interface EffectOptions {
  /** Whether a `super(...)` call is the constructor's own, and so no effect. */
  superCall?: boolean;
  /** Indices to leave out, such as the `=` of a declarator. */
  skip?: ReadonlySet<number>;
}

/** The index of the first token of `span` that does something as it runs, outside the functions in it, or -1. */
export function firstEffect(
  context: EffectContext,
  span: Span,
  options: EffectOptions = {},
): number {
  const { bundle } = context;
  const table = analyseScopes(
    bundle.tokens,
    bundle.pairs,
    span.start,
    span.end,
  );
  for (let at = span.start; at < span.end; at += 1) {
    if (table.nested(at) || options.skip?.has(at)) continue;
    const token = bundle.tokens[at];
    if (token === undefined) return at;
    if (
      token.kind === 'name' &&
      isPropertyName({ tokens: bundle.tokens, pairs: bundle.pairs }, at)
    ) {
      continue;
    }
    if (WRITES.has(token.text)) return at;
    if (token.kind === 'name' && token.text === 'new') {
      if (!isQuietNew(context, at)) return at;
      continue;
    }
    if (token.kind === 'template') {
      const before = bundle.tokens[at - 1];
      const tagged =
        token.text.startsWith('`') &&
        (before?.kind === 'name'
          ? !NOT_CALLEE.has(before.text)
          : before?.text === ')' || before?.text === ']');
      if (tagged) return at;
      continue;
    }
    if (!isCall(bundle, at)) continue;
    if (text(bundle, at - 2) === 'new') continue;
    if (options.superCall === true && text(bundle, at - 1) === 'super')
      continue;
    if (
      isRequire(context, at) ||
      isBinding(context, at) ||
      isHelper(context, at)
    ) {
      continue;
    }
    return at;
  }
  return -1;
}

/** Whether the tokens of `span` do something as they run, outside the functions in it. */
export function makesEffect(
  context: EffectContext,
  span: Span,
  options: EffectOptions = {},
): boolean {
  return firstEffect(context, span, options) >= 0;
}
