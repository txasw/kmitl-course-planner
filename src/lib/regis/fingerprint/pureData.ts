// What counts as pure static data in the App shell's menus (ADR-0079, amendment of
// 2026-11-26): an object or an array whose entries are only strings, numbers, booleans,
// null, templates with no substitution, other pure data, spreads of pure data, and a
// choice `c ? a : b` between pure data on a module constant. A module constant is a
// name the module defines once as pure data with no name in it, as a minifier writes a
// build flag such as `var x=!1`. A function, a call, a member access, a computed or
// shorthand key, a method, a getter, or any other name makes the whole literal impure.

import { text } from './locate.ts';
import type { Bundle, ModuleScope } from './module.ts';

/** How many plain aliases, such as `a=b`, a constant is followed through. */
const ALIAS_LIMIT = 8;

/**
 * Where a pure value is read: the bundle, and the module whose constants it may name,
 * or null where no name may stand in it.
 */
export interface PureContext {
  bundle: Bundle;
  module: ModuleScope | null;
}

export function isOpenLiteral(bundle: Bundle, at: number): boolean {
  const word = text(bundle, at);
  return (word === '{' || word === '[') && bundle.tokens[at]?.kind === 'punct';
}

/** Whether `name` is a module constant: defined once as pure data with no name in it. */
function isConstant(context: PureContext, name: string): boolean {
  const { bundle, module } = context;
  if (module === null) return false;
  let span = module.definitions.get(name);
  for (let step = 0; step < ALIAS_LIMIT; step += 1) {
    if (span === undefined || span === null) return false;
    if (
      span.end - span.start !== 1 ||
      bundle.tokens[span.start]?.kind !== 'name'
    ) {
      break;
    }
    span = module.definitions.get(text(bundle, span.start));
  }
  if (span === undefined || span === null) return false;
  return valueEnd({ bundle, module: null }, span.start) === span.end;
}

/** The index past a pure value at `at` with no choice in it, or -1. */
function primaryEnd(context: PureContext, at: number): number {
  const { bundle } = context;
  const token = bundle.tokens[at];
  if (token === undefined) return -1;
  switch (token.kind) {
    case 'string':
    case 'number':
      return at + 1;
    case 'template':
      // A template chunk that opens and closes on a backtick holds no substitution.
      return token.text.length > 1 &&
        token.text.startsWith('`') &&
        token.text.endsWith('`')
        ? at + 1
        : -1;
    case 'name':
      return ['true', 'false', 'null'].includes(token.text) ||
        isConstant(context, token.text)
        ? at + 1
        : -1;
    case 'regex':
      return -1;
    case 'punct':
      break;
  }
  const next = bundle.tokens[at + 1];
  if (token.text === '!' && next?.kind === 'number') {
    return next.text === '0' || next.text === '1' ? at + 2 : -1;
  }
  if (token.text === '-' && next?.kind === 'number') return at + 2;
  if (isOpenLiteral(bundle, at)) {
    return membersPure(context, at) ? (bundle.pairs[at] ?? at) + 1 : -1;
  }
  return -1;
}

/** The index past a pure value at `at`, a choice between pure values included, or -1. */
export function valueEnd(context: PureContext, at: number): number {
  const end = primaryEnd(context, at);
  if (end < 0 || text(context.bundle, end) !== '?') return end;
  const middle = valueEnd(context, end + 1);
  if (middle < 0 || text(context.bundle, middle) !== ':') return -1;
  return valueEnd(context, middle + 1);
}

/** Whether every entry of the object or array that opens at `open` is pure data. */
function membersPure(context: PureContext, open: number): boolean {
  const { bundle } = context;
  const object = text(bundle, open) === '{';
  const close = bundle.pairs[open] ?? -1;
  if (close < open) return false;
  let at = open + 1;
  while (at < close) {
    let end: number;
    if (text(bundle, at) === '...') {
      end = valueEnd(context, at + 1);
    } else if (object) {
      const key = bundle.tokens[at]?.kind;
      const keyed =
        (key === 'name' || key === 'string' || key === 'number') &&
        text(bundle, at + 1) === ':';
      end = keyed ? valueEnd(context, at + 2) : -1;
    } else {
      end = valueEnd(context, at);
    }
    if (end < 0) return false;
    if (end === close) return true;
    if (text(bundle, end) !== ',') return false;
    at = end + 1;
  }
  return true;
}
