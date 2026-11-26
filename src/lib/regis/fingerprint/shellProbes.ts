// The probes and neutral edits of the App shell (ADR-0079, amendments of 2026-11-26 and
// 2026-11-27). The probes are shell changes the setup part must still see: a function in
// the drawer's menu data, a drawer method that calls the API, a click handler on the app
// bar, an attribute in the app bar's data, a key beside the drawer's menu, a menu link
// that runs script, and a logout action added to a menu entry.
// The neutral edits are the shell changes it leaves out, which must change no part: the
// drawer's menu entries regrouped, an entry added, and a changed label and icon. Nothing
// here ships: the worker imports none of it.

import { locateComponent, text } from './locate.ts';
import { readBundle, type Bundle } from './module.ts';
import { COMPONENT_PARTS } from './partIds.ts';
import {
  firstIn,
  insertAfter,
  replaceAt,
  type NeutralEdit,
  type Probe,
} from './probeEdits.ts';
import { dataValue, propertyValue, shellComponents } from './shell.ts';

/** A shell component of a bundle by the key the App registers it under. */
function shellOf(bundle: Bundle, key: string) {
  const module =
    locateComponent(bundle, COMPONENT_PARTS.addSubject)?.module ?? null;
  if (module === null) return null;
  return (
    shellComponents(bundle, module).find(
      (component) => component.key === key,
    ) ?? null
  );
}

/** The opening brace of the data value of a shell component, or -1. */
function dataOf(bundle: Bundle, key: string): number {
  const options = shellOf(bundle, key)?.options ?? null;
  const value = options === null ? -1 : dataValue(bundle, options);
  return text(bundle, value) === '{' ? value : -1;
}

/** The first array the drawer's data holds, as its menu is, by its opening bracket. */
function drawerMenu(bundle: Bundle): number {
  const value = dataOf(bundle, 'Drawer');
  if (value < 0) return -1;
  return firstIn(
    { start: value, end: bundle.pairs[value] ?? value },
    (index) => text(bundle, index) === '[' && text(bundle, index - 1) === ':',
  );
}

/** The opening brace of each entry of the menu array at `menu`. */
function menuEntries(bundle: Bundle, menu: number): number[] {
  const entries: number[] = [];
  const close = bundle.pairs[menu] ?? menu;
  for (let index = menu + 1; index < close; index += 1) {
    if (bundle.parents[index] === menu && text(bundle, index) === '{') {
      entries.push(index);
    }
  }
  return entries;
}

/** The string value of the first `key` inside the drawer's menu, by index. */
function menuString(bundle: Bundle, key: string): number {
  const menu = drawerMenu(bundle);
  if (menu < 0) return -1;
  return firstIn(
    { start: menu, end: bundle.pairs[menu] ?? menu },
    (index) =>
      text(bundle, index - 2) === key &&
      text(bundle, index - 1) === ':' &&
      bundle.tokens[index]?.kind === 'string',
  );
}

/** The source text of the tokens from `open` through the bracket that closes it. */
function bracketText(source: string, bundle: Bundle, open: number): string {
  const first = bundle.tokens[open];
  const last = bundle.tokens[bundle.pairs[open] ?? open];
  return first === undefined || last === undefined
    ? ''
    : source.slice(first.start, last.start + last.text.length);
}

export const SHELL_PROBES: readonly Probe[] = [
  {
    id: 'function:shellData',
    part: 'setup',
    describe: "a function added to an entry of the drawer's menu data",
    apply: (source) => {
      const bundle = readBundle(source);
      const menu = drawerMenu(bundle);
      const [entry] = menu < 0 ? [] : menuEntries(bundle, menu);
      return entry === undefined
        ? null
        : insertAfter(source, bundle, entry, 'kcpProbe:function(){},');
    },
  },
  {
    id: 'method:shellApi',
    part: 'setup',
    describe: 'a method added to the drawer that calls the API',
    apply: (source) => {
      const bundle = readBundle(source);
      const options = shellOf(bundle, 'Drawer')?.options ?? null;
      const methods =
        options === null ? -1 : propertyValue(bundle, options.start, 'methods');
      return methods < 0 || text(bundle, methods) !== '{'
        ? null
        : insertAfter(
            source,
            bundle,
            methods,
            'kcpProbe(){return this.$store.dispatch("registration/kcpProbe")},',
          );
    },
  },
  {
    id: 'handler:shellBar',
    part: 'setup',
    describe: 'a click handler added to the app bar',
    apply: (source) => {
      const bundle = readBundle(source);
      const render = shellOf(bundle, 'AppBar')?.render ?? null;
      if (render === null) return null;
      const attrs = firstIn(
        render,
        (index) =>
          text(bundle, index) === 'attrs' && text(bundle, index + 1) === ':',
      );
      return attrs < 0
        ? null
        : replaceAt(
            source,
            bundle,
            attrs,
            'on:{click:function(){kcpProbe()}},attrs',
          );
    },
  },
  {
    id: 'attrs:shellBar',
    part: 'setup',
    describe:
      "an inline handler in the app bar's data, which Vue binds onto a button",
    apply: (source) => {
      const bundle = readBundle(source);
      const value = dataOf(bundle, 'AppBar');
      return value < 0
        ? null
        : insertAfter(
            source,
            bundle,
            value,
            'attrs:{onanimationstart:"kcpProbe()"},',
          );
    },
  },
  {
    id: 'key:shellData',
    part: 'setup',
    describe:
      "a key beside the drawer's menu, which Vue sets over a computed value",
    apply: (source) => {
      const bundle = readBundle(source);
      const value = dataOf(bundle, 'Drawer');
      return value < 0
        ? null
        : insertAfter(source, bundle, value, 'student_id:"kcp_probe",');
    },
  },
  {
    id: 'href:shellData',
    part: 'setup',
    describe: "a javascript link added to an entry of the drawer's menu",
    apply: (source) => {
      const bundle = readBundle(source);
      const menu = drawerMenu(bundle);
      const [entry] = menu < 0 ? [] : menuEntries(bundle, menu);
      return entry === undefined
        ? null
        : insertAfter(source, bundle, entry, 'href:"javascript:kcpProbe()",');
    },
  },
  {
    id: 'action:shellData',
    part: 'setup',
    describe: "a logout action added to an entry of the drawer's menu",
    apply: (source) => {
      const bundle = readBundle(source);
      const menu = drawerMenu(bundle);
      const [entry] = menu < 0 ? [] : menuEntries(bundle, menu);
      return entry === undefined
        ? null
        : insertAfter(source, bundle, entry, 'action:"logout",');
    },
  },
];

/** Shell changes the setup leaves out: each must leave every part as it was. */
export const NEUTRAL_EDITS: readonly NeutralEdit[] = [
  {
    id: 'regroup:shellData',
    describe: "the first two entries of the drawer's menu swapped",
    apply: (source) => {
      const bundle = readBundle(source);
      const menu = drawerMenu(bundle);
      const [first, second] = menu < 0 ? [] : menuEntries(bundle, menu);
      const start = first === undefined ? undefined : bundle.tokens[first];
      const end =
        second === undefined
          ? undefined
          : bundle.tokens[bundle.pairs[second] ?? second];
      if (
        first === undefined ||
        second === undefined ||
        start === undefined ||
        end === undefined
      ) {
        return null;
      }
      return (
        source.slice(0, start.start) +
        bracketText(source, bundle, second) +
        ',' +
        bracketText(source, bundle, first) +
        source.slice(end.start + end.text.length)
      );
    },
  },
  {
    id: 'entry:shellData',
    describe: "an entry with a new label added to the drawer's menu",
    apply: (source) => {
      const bundle = readBundle(source);
      const menu = drawerMenu(bundle);
      return menu < 0
        ? null
        : insertAfter(
            source,
            bundle,
            menu,
            '{to:"kcp_probe",label:"drawer.kcp_probe",icon:"mdi-help",active:!1},',
          );
    },
  },
  {
    id: 'label:shellData',
    describe: "a changed label of an entry of the drawer's menu",
    apply: (source) => {
      const bundle = readBundle(source);
      const label = menuString(bundle, 'label');
      return label < 0
        ? null
        : replaceAt(source, bundle, label, '"drawer.kcp_probe"');
    },
  },
  {
    id: 'icon:shellData',
    describe: "a changed icon of an entry of the drawer's menu",
    apply: (source) => {
      const bundle = readBundle(source);
      const icon = menuString(bundle, 'icon');
      return icon < 0 ? null : replaceAt(source, bundle, icon, '"mdi-help"');
    },
  },
];
