// The drawer menu's own vocabulary (ADR-0079, amendments of 2026-11-26 and 2026-11-27).
// The setup part writes a menu entry as one word only when every key and value in it is
// one the drawer's render reads as plain navigation: a route path or a route name, a link
// to a manual on the registrar's storage, a message key, an icon name, the permission
// names a method checks, the login or logout action, and flags. Vue and Vuetify turn some
// literals into behaviour, such as a `javascript:` link, so a value of any other shape
// keeps its entry in full. A choice `c ? a : b` stands where a value or a spread of
// entries does only when `c` is a module constant written as `!0` or `!1`, as the
// minifier writes the build flag the staff entries choose on, and both branches follow
// the same rules. A spread of a named constant is never one, since code that runs
// anywhere could fill the constant at run time.

import { text } from './locate.ts';
import type { Bundle, ModuleScope } from './module.ts';

/** How many plain aliases, such as `a=b`, a flag is followed through. */
const ALIAS_LIMIT = 8;

export interface MenuContext {
  bundle: Bundle;
  module: ModuleScope;
}

/** The index just past a value that follows a rule, or -1 when it does not. */
type Rule = (context: MenuContext, at: number) => number;

/** A plain quoted string with no escape whose content matches `pattern`. */
function string(pattern: RegExp): Rule {
  return ({ bundle }, at) => {
    const token = bundle.tokens[at];
    if (token?.kind !== 'string') return -1;
    const quote = token.text[0];
    const content = token.text.slice(1, -1);
    if ((quote !== '"' && quote !== "'") || content.includes('\\')) return -1;
    return pattern.test(content) ? at + 1 : -1;
  };
}

/** The index past a boolean written as `!0`, `!1`, `true`, or `false`, or -1. */
function booleanEnd(bundle: Bundle, at: number): number {
  const token = bundle.tokens[at];
  if (token?.kind === 'name')
    return token.text === 'true' || token.text === 'false' ? at + 1 : -1;
  const next = bundle.tokens[at + 1];
  return token?.text === '!' &&
    next?.kind === 'number' &&
    (next.text === '0' || next.text === '1')
    ? at + 2
    : -1;
}

const flag: Rule = ({ bundle }, at) => booleanEnd(bundle, at);

const nothing: Rule = ({ bundle }, at) =>
  bundle.tokens[at]?.kind === 'name' && text(bundle, at) === 'null'
    ? at + 1
    : -1;

function either(...rules: Rule[]): Rule {
  return (context, at) => {
    for (const rule of rules) {
      const end = rule(context, at);
      if (end >= 0) return end;
    }
    return -1;
  };
}

/** Whether the name at `at` is a module constant whose value is a boolean literal. */
function isBuildFlag({ bundle, module }: MenuContext, at: number): boolean {
  if (bundle.tokens[at]?.kind !== 'name') return false;
  let span = module.definitions.get(text(bundle, at));
  for (let step = 0; step < ALIAS_LIMIT; step += 1) {
    if (span === undefined || span === null) return false;
    const single =
      span.end - span.start === 1 && bundle.tokens[span.start]?.kind === 'name';
    if (!single || booleanEnd(bundle, span.start) === span.end) break;
    span = module.definitions.get(text(bundle, span.start));
  }
  return (
    span?.start !== undefined && booleanEnd(bundle, span.start) === span.end
  );
}

/** A value that follows `rule`, or a choice on a build flag between two that do. */
function choice(rule: Rule): Rule {
  const read: Rule = (context, at) => {
    if (!isBuildFlag(context, at) || text(context.bundle, at + 1) !== '?') {
      return rule(context, at);
    }
    const middle = read(context, at + 2);
    if (middle < 0 || text(context.bundle, middle) !== ':') return -1;
    return read(context, middle + 1);
  };
  return read;
}

/** Whether the token at `at` is an opening bracket `word`, not a string or a name. */
function opens(bundle: Bundle, at: number, word: '{' | '['): boolean {
  return bundle.tokens[at]?.kind === 'punct' && text(bundle, at) === word;
}

/**
 * An array whose elements each follow `element`, or are a spread of a choice between
 * arrays that do. A spread of anything else, such as a named constant, which code that
 * runs anywhere could fill at run time, is not one.
 */
function array(element: () => Rule): Rule {
  return (context, at) => {
    const { bundle } = context;
    if (!opens(bundle, at, '[')) return -1;
    const close = bundle.pairs[at] ?? -1;
    if (close < at) return -1;
    let next = at + 1;
    while (next < close) {
      const end =
        text(bundle, next) === '...'
          ? choice(spreadable(element))(context, next + 1)
          : choice(element())(context, next);
      if (end === close) return close + 1;
      if (end < 0 || text(bundle, end) !== ',') return -1;
      next = end + 1;
    }
    return next === at + 1 ? close + 1 : -1;
  };
}

/** What a spread may hold: an array literal, never a name. */
function spreadable(element: () => Rule): Rule {
  return (context, at) =>
    opens(context.bundle, at, '[') ? array(element)(context, at) : -1;
}

/** An object with name keys only from `rules`, each once, with a value that follows its rule. */
function object(rules: ReadonlyMap<string, Rule>): Rule {
  return (context, at) => {
    const { bundle } = context;
    if (!opens(bundle, at, '{')) return -1;
    const close = bundle.pairs[at] ?? -1;
    if (close < at) return -1;
    const seen = new Set<string>();
    let next = at + 1;
    while (next < close) {
      const key = text(bundle, next);
      const rule = rules.get(key);
      if (
        bundle.tokens[next]?.kind !== 'name' ||
        rule === undefined ||
        seen.has(key) ||
        text(bundle, next + 1) !== ':'
      ) {
        return -1;
      }
      seen.add(key);
      const end = choice(rule)(context, next + 2);
      if (end === close) return close + 1;
      if (end < 0 || text(bundle, end) !== ',') return -1;
      next = end + 1;
    }
    return next === at + 1 ? close + 1 : -1;
  };
}

const PERMISSION = string(/^[a-z_]+$/);

/** The keys a menu entry may hold, each with the rule its value follows. */
const ENTRY_KEYS = new Map<string, Rule>([
  [
    'to',
    either(
      string(/^\/?[a-z0-9_]*$/),
      object(new Map([['name', string(/^[a-z0-9_]+$/)]])),
    ),
  ],
  [
    'href',
    string(/^https:\/\/www\.reg\.kmitl\.ac\.th\/storage\/[A-Za-z0-9_./-]+$/),
  ],
  ['target', string(/^_blank$/)],
  ['label', string(/^[a-z_]+(\.[a-z_]+)+$/)],
  ['icon', string(/^mdi-[a-z0-9-]+$/)],
  [
    'check_permission',
    either(
      nothing,
      array(() => PERMISSION),
    ),
  ],
  ['check_permission_condition', either(flag, nothing)],
  ['active', flag],
  ['noti_badge', flag],
  ['action', string(/^(login|logout)$/)],
  ['subItems', array(() => entry)],
]);

/** One menu entry: an object with only the drawer's own keys and values. */
const entry: Rule = object(ENTRY_KEYS);

/** The index past a menu element at `at`, an entry or a spread of a choice of them, or -1. */
export function menuElementEnd(context: MenuContext, at: number): number {
  return text(context.bundle, at) === '...'
    ? choice(spreadable(() => entry))(context, at + 1)
    : choice(entry)(context, at);
}

/** The index past a menu array at `at` whose every element is plain navigation, or -1. */
export function menuEnd(context: MenuContext, at: number): number {
  return array(() => entry)(context, at);
}
