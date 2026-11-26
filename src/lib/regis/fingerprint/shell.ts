// The App shell as the setup part reads it (ADR-0079, amendments of 2026-11-26 and
// 2026-11-27). The root instance renders the App, and the App registers the bar, the
// drawer, and the footer that wrap every page. The drawer's menu lists staff pages, which
// the host regroups often, so the value of `nav`, the one key of the drawer's data, is a
// boundary: when every entry in it is plain navigation in the drawer's own vocabulary
// (drawerMenu.ts) it is written as one word, and otherwise each entry that is plain
// navigation is. The drawer's scoped style id, which vue-loader derives from the
// component's file, is written as one word too. Everything else stays in the
// fingerprint: the data of the App, the bar, and the footer, whose values Vue binds onto
// elements, any other key of the drawer's data, which Vue would set over a method or a
// computed value of the same name, every option, method, computed value, watcher, hook,
// render function, handler, and directive, and every menu entry with any other key or
// value.

import { locateComponent, text } from './locate.ts';
import type { Bundle, ModuleScope, Replacement, Span } from './module.ts';
import { menuElementEnd, menuEnd, type MenuContext } from './drawerMenu.ts';

/** The components the App registers around every page, by the key it gives each. */
const SHELL_KEYS = ['AppBar', 'Drawer', 'Footer'] as const;

/** The one shell component whose menu data and scoped style id are a boundary. */
const MENU_KEY = 'Drawer';

/** A scoped style id as vue-loader writes it, derived from the component's file. */
const SCOPE_ID = /^"[0-9a-f]{8}"$/;

/** How many plain aliases, such as `a=b`, a name is followed through. */
const ALIAS_LIMIT = 8;

export interface ShellComponent {
  key: string;
  /** The options object, or null when the call does not name one KCP can place. */
  options: Span | null;
  render: Span | null;
  /** The index of the scoped style id in the component's call, or -1. */
  scopeId: number;
}

/** Whether a definition is a whole `(0,x.y)(...)` call, as vue-loader binds a component. */
function componentCallOpen(bundle: Bundle, span: Span): number {
  const at = (offset: number) => text(bundle, span.start + offset);
  const shaped =
    at(0) === '(' &&
    at(1) === '0' &&
    at(2) === ',' &&
    at(4) === '.' &&
    at(6) === ')' &&
    at(7) === '(';
  const open = span.start + 7;
  return shaped && (bundle.pairs[open] ?? -1) + 1 === span.end ? open : -1;
}

/** The spans of the arguments of the call whose parenthesis opens at `open`. */
function callArgs(bundle: Bundle, open: number): Span[] {
  const close = bundle.pairs[open] ?? open;
  const args: Span[] = [];
  let start = open + 1;
  for (let at = open + 1; at <= close; at += 1) {
    if (
      at === close ||
      (text(bundle, at) === ',' && bundle.parents[at] === open)
    ) {
      if (at > start) args.push({ start, end: at });
      start = at + 1;
    }
  }
  return args;
}

/** A span followed through plain aliases to the definition it names. */
function resolve(bundle: Bundle, module: ModuleScope, span: Span): Span {
  let current = span;
  for (let step = 0; step < ALIAS_LIMIT; step += 1) {
    if (current.end - current.start !== 1) return current;
    if (bundle.tokens[current.start]?.kind !== 'name') return current;
    const next = module.definitions.get(text(bundle, current.start));
    if (next === undefined || next === null) return current;
    current = next;
  }
  return current;
}

/** The index of the value of `key` among an object's own properties, or -1. */
export function propertyValue(
  bundle: Bundle,
  object: number,
  key: string,
): number {
  const close = bundle.pairs[object] ?? object;
  for (let at = object + 1; at < close; at += 1) {
    if (
      bundle.parents[at] === object &&
      text(bundle, at) === key &&
      text(bundle, at + 1) === ':' &&
      (text(bundle, at - 1) === '{' || text(bundle, at - 1) === ',')
    ) {
      return at + 2;
    }
  }
  return -1;
}

/** The shell component a registry value names, through its `x.exports`. */
function registered(
  bundle: Bundle,
  module: ModuleScope,
  value: number,
): Span | null {
  if (bundle.tokens[value]?.kind !== 'name') return null;
  const after = text(bundle, value + 1);
  if (after !== ',' && after !== '}') return null;
  const exports = resolve(bundle, module, { start: value, end: value + 1 });
  if (
    exports.end - exports.start !== 3 ||
    text(bundle, exports.start + 1) !== '.' ||
    text(bundle, exports.start + 2) !== 'exports'
  ) {
    return null;
  }
  return module.definitions.get(text(bundle, exports.start)) ?? null;
}

function shellComponent(
  bundle: Bundle,
  module: ModuleScope,
  key: string,
  call: Span,
): ShellComponent | null {
  const open = componentCallOpen(bundle, call);
  if (open < 0) return null;
  const [options, render, , , , scope] = callArgs(bundle, open);
  const object =
    options === undefined ? null : resolve(bundle, module, options);
  const scopeId =
    scope !== undefined &&
    scope.end - scope.start === 1 &&
    SCOPE_ID.test(text(bundle, scope.start))
      ? scope.start
      : -1;
  return {
    key,
    options:
      object !== null && text(bundle, object.start) === '{' ? object : null,
    render: render === undefined ? null : resolve(bundle, module, render),
    scopeId,
  };
}

/** The App and the bar, drawer, and footer it registers, each that KCP can place. */
export function shellComponents(
  bundle: Bundle,
  module: ModuleScope,
): ShellComponent[] {
  const app = locateComponent(bundle, 'App');
  if (app?.module.body !== module.body) return [];
  const found: ShellComponent[] = [];
  const root = shellComponent(bundle, module, 'App', app.call);
  if (root !== null) found.push(root);
  const registry = propertyValue(bundle, app.options.start, 'components');
  if (registry < 0 || text(bundle, registry) !== '{') return found;
  for (const key of SHELL_KEYS) {
    const at = propertyValue(bundle, registry, key);
    const call = at < 0 ? null : registered(bundle, module, at);
    const component =
      call === null ? null : shellComponent(bundle, module, key, call);
    if (component !== null) found.push(component);
  }
  return found;
}

function isOpenLiteral(bundle: Bundle, at: number): boolean {
  const word = text(bundle, at);
  return (word === '{' || word === '[') && bundle.tokens[at]?.kind === 'punct';
}

/** Whether the token just past the brackets that open at `open` is `next`. */
function closesBefore(bundle: Bundle, open: number, next: string): boolean {
  return text(bundle, (bundle.pairs[open] ?? open) + 1) === next;
}

/**
 * The object or array the options' data function returns, as `data:()=>({...})`,
 * `data(){return{...}}`, or `data:function(){return{...}}` writes it, or -1.
 */
export function dataValue(bundle: Bundle, options: Span): number {
  const close = options.end - 1;
  for (let at = options.start + 1; at < close; at += 1) {
    if (
      bundle.parents[at] !== options.start ||
      text(bundle, at) !== 'data' ||
      (text(bundle, at - 1) !== '{' && text(bundle, at - 1) !== ',')
    ) {
      continue;
    }
    let next = at + 1;
    if (text(bundle, next) === ':') next += 1;
    if (text(bundle, next) === 'function') next += 1;
    // A data function that takes a parameter could bind a name its data uses, so only
    // one with none is read; any other is no boundary and stays in full.
    if (text(bundle, next) !== '(' || text(bundle, next + 1) !== ')') return -1;
    next += 2;
    if (text(bundle, next) === '=>') {
      next += 1;
      if (text(bundle, next) === '(') {
        const value = next + 1;
        return isOpenLiteral(bundle, value) && closesBefore(bundle, value, ')')
          ? value
          : -1;
      }
    }
    if (text(bundle, next) !== '{' || text(bundle, next + 1) !== 'return')
      return -1;
    const value = next + 2;
    const body = bundle.pairs[next] ?? next;
    const end = (bundle.pairs[value] ?? value) + 1;
    const tail = text(bundle, end) === ';' ? end + 1 : end;
    return isOpenLiteral(bundle, value) && tail === body ? value : -1;
  }
  return -1;
}

/**
 * The menu of a drawer data value written `{nav:[...]}`, with no other key, or -1. Its
 * key stays in the canonical text, so a key added beside it is read in full.
 */
function menuValue(bundle: Bundle, value: number): number {
  const menu = value + 3;
  return text(bundle, value) === '{' &&
    bundle.tokens[value + 1]?.kind === 'name' &&
    text(bundle, value + 1) === 'nav' &&
    text(bundle, value + 2) === ':' &&
    isOpenLiteral(bundle, menu) &&
    text(bundle, menu) === '[' &&
    (bundle.pairs[menu] ?? menu) + 1 === bundle.pairs[value]
    ? menu
    : -1;
}

/**
 * The runs of the menu array at `menu` written as one word: the whole array when every
 * element is plain navigation, or else each element that is.
 */
function menuRuns(
  context: MenuContext,
  menu: number,
  out: Map<number, Replacement>,
): void {
  const { bundle } = context;
  const end = menuEnd(context, menu);
  if (end >= 0) {
    out.set(menu, { word: '@data', end });
    return;
  }
  const close = bundle.pairs[menu] ?? menu;
  for (let at = menu + 1; at < close;) {
    const past = menuElementEnd(context, at);
    const valid = past >= 0 && (past === close || text(bundle, past) === ',');
    if (valid) out.set(at, { word: '@data', end: past });
    let next = valid ? past : at;
    while (
      next < close &&
      (text(bundle, next) !== ',' || bundle.parents[next] !== menu)
    ) {
      next += 1;
    }
    at = next + 1;
  }
}

/** What the setup part writes as one word inside the App shell: the drawer's menu. */
export function shellReplacements(
  bundle: Bundle,
  module: ModuleScope,
): Map<number, Replacement> {
  const out = new Map<number, Replacement>();
  for (const component of shellComponents(bundle, module)) {
    if (component.key !== MENU_KEY) continue;
    const value =
      component.options === null ? -1 : dataValue(bundle, component.options);
    const menu = value < 0 ? -1 : menuValue(bundle, value);
    if (menu >= 0) menuRuns({ bundle, module }, menu, out);
    if (component.scopeId >= 0) {
      out.set(component.scopeId, {
        word: '@scope',
        end: component.scopeId + 1,
      });
    }
  }
  return out;
}
