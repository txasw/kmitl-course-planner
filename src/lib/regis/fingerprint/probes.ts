// Synthetic edits that prove each part's fingerprint sees a change in it (ADR-0079). Each
// probe makes one small edit at a token it finds in a bundle: an added option on every
// page component, a changed button handler and an added call in the add subject card, a
// changed attribute in the grade not announced dialog, a changed interval in the period
// check, a changed timeout in the API client, a changed write endpoint name, a plugin
// and an action call added to the store, a statement and a global mixin added to what
// the module runs as it loads, the pre registration route moved, and a changed label. scripts/host-fingerprint.mjs runs them on the saved host bundles and the
// unit tests run them on the replica bundle, so both check the same edits. Nothing here
// ships: the worker imports none of it.

import {
  catalogNames,
  clientSpan,
  gradeDialogSpan,
  locateComponent,
  periodMixins,
  storeNames,
  stringsOf,
  text,
} from './locate.ts';
import { catalogOpens, valueIndex } from './labels.ts';
import { readBundle, type Bundle, type Span } from './module.ts';
import { COMPONENT_PARTS, type PartId } from './partIds.ts';
import { expressionEnd } from './scopes.ts';
import { moduleItems, storeSpan } from './setup.ts';
import { writeReferences } from './writes.ts';

export interface Probe {
  id: string;
  /** The part the edit is in, whose fingerprint must change. */
  part: PartId;
  describe: string;
  /** The bundle with the edit, or null when its anchor is not in this bundle. */
  apply: (
    source: string,
    writeDigests: ReadonlySet<string>,
  ) => Promise<string | null> | string | null;
}

function replaceAt(
  source: string,
  bundle: Bundle,
  index: number,
  value: string,
): string | null {
  const token = bundle.tokens[index];
  if (token === undefined || index < 0) return null;
  return (
    source.slice(0, token.start) +
    value +
    source.slice(token.start + token.text.length)
  );
}

function insertAfter(
  source: string,
  bundle: Bundle,
  index: number,
  value: string,
): string | null {
  const token = bundle.tokens[index];
  if (token === undefined || index < 0) return null;
  const end = token.start + token.text.length;
  return source.slice(0, end) + value + source.slice(end);
}

/** The host store's definition in a bundle, or null. */
function storeOf(bundle: Bundle): Span | null {
  const module = addSubject(bundle)?.module ?? null;
  return module === null ? null : storeSpan(module, storeNames(bundle, module));
}

function firstIn(span: Span, test: (index: number) => boolean): number {
  for (let index = span.start; index < span.end; index += 1) {
    if (test(index)) return index;
  }
  return -1;
}

function addSubject(bundle: Bundle) {
  return locateComponent(bundle, COMPONENT_PARTS.addSubject);
}

/** A number token's text changed to another number. */
function bumped(bundle: Bundle, index: number): string {
  return `${text(bundle, index)}1`;
}

const optionProbes: Probe[] = (
  Object.entries(COMPONENT_PARTS) as [PartId, string][]
).map(([part, name]) => ({
  id: `option:${part}`,
  part,
  describe: `an added option on ${name}`,
  apply: (source) => {
    const bundle = readBundle(source);
    const key = stringsOf(bundle, `"${name}"`).find(
      (index) =>
        text(bundle, index - 2) === 'name' && text(bundle, index - 1) === ':',
    );
    return key === undefined
      ? null
      : insertAfter(source, bundle, key, ',kcpProbe:1');
  },
}));

export const PROBES: readonly Probe[] = [
  ...optionProbes,
  {
    id: 'handler:addSubject',
    part: 'addSubject',
    describe: 'a button of the add subject card calling another method',
    apply: (source) => {
      const bundle = readBundle(source);
      const render = addSubject(bundle)?.render ?? null;
      if (render === null) return null;
      const click = firstIn(
        render,
        (index) =>
          text(bundle, index) === 'click' && text(bundle, index + 1) === ':',
      );
      const call = firstIn(
        { start: click + 1, end: render.end },
        (index) =>
          text(bundle, index - 1) === '.' && text(bundle, index + 1) === '(',
      );
      return click < 0 || call < 0
        ? null
        : replaceAt(source, bundle, call, `${text(bundle, call)}Probe`);
    },
  },
  {
    id: 'call:addSubject',
    part: 'addSubject',
    describe: 'an added call in a method of the add subject card',
    apply: (source) => {
      const bundle = readBundle(source);
      const options = addSubject(bundle)?.options ?? null;
      if (options === null) return null;
      const methods = firstIn(
        options,
        (index) =>
          text(bundle, index) === 'methods' && text(bundle, index + 1) === ':',
      );
      const body = firstIn(
        { start: methods + 2, end: options.end },
        (index) =>
          text(bundle, index) === '{' && text(bundle, index - 1) === ')',
      );
      return methods < 0 || body < 0
        ? null
        : insertAfter(source, bundle, body, 'this.kcpProbe();');
    },
  },
  {
    id: 'attribute:gradeDialog',
    part: 'gradeDialog',
    describe: 'a changed attribute of the grade not announced dialog',
    apply: (source) => {
      const bundle = readBundle(source);
      const render = addSubject(bundle)?.render ?? null;
      const dialog = render === null ? null : gradeDialogSpan(bundle, render);
      if (dialog === null) return null;
      const value = firstIn(
        dialog,
        (index) => bundle.tokens[index]?.kind === 'string',
      );
      return replaceAt(
        source,
        bundle,
        value,
        `"${text(bundle, value).slice(1, -1)}probe"`,
      );
    },
  },
  {
    id: 'interval:periodCheck',
    part: 'periodCheck',
    describe: 'a changed number in the period check',
    apply: (source) => {
      const bundle = readBundle(source);
      const route = locateComponent(bundle, COMPONENT_PARTS.route) ?? undefined;
      const [mixin] = periodMixins(bundle, route);
      if (mixin === undefined) return null;
      const number = firstIn(
        mixin,
        (index) => bundle.tokens[index]?.kind === 'number',
      );
      return replaceAt(source, bundle, number, bumped(bundle, number));
    },
  },
  {
    id: 'timeout:client',
    part: 'client',
    describe: 'a changed number in the API client',
    apply: (source) => {
      const bundle = readBundle(source);
      const route = locateComponent(bundle, COMPONENT_PARTS.addSubject);
      const client = route === null ? null : clientSpan(bundle, route.module);
      if (client === null) return null;
      const number = firstIn(
        client,
        (index) => bundle.tokens[index]?.kind === 'number',
      );
      return replaceAt(source, bundle, number, bumped(bundle, number));
    },
  },
  {
    id: 'endpoint:writes',
    part: 'writes',
    describe: 'a changed name of a registration write endpoint',
    apply: async (source, writeDigests) => {
      const bundle = readBundle(source);
      const [write] = await writeReferences(bundle, writeDigests);
      if (write === undefined) return null;
      return replaceAt(
        source,
        bundle,
        write,
        `"${text(bundle, write).slice(1, -1)}-probe"`,
      );
    },
  },
  {
    id: 'plugin:store',
    part: 'store',
    describe: 'a plugin added to the store',
    apply: (source) => {
      const bundle = readBundle(source);
      const store = storeOf(bundle);
      if (store === null) return null;
      const open = firstIn(
        store,
        (index) =>
          text(bundle, index) === '{' && text(bundle, index - 1) === '(',
      );
      return insertAfter(source, bundle, open, 'plugins:[kcpProbe],');
    },
  },
  {
    id: 'action:store',
    part: 'store',
    describe: 'an added call in an action of a store module',
    apply: (source) => {
      const bundle = readBundle(source);
      const store = storeOf(bundle);
      const module = addSubject(bundle)?.module ?? null;
      if (store === null || module === null) return null;
      const modules = firstIn(
        store,
        (index) =>
          text(bundle, index) === 'modules' && text(bundle, index + 1) === ':',
      );
      const first = module.definitions.get(text(bundle, modules + 5)) ?? null;
      if (modules < 0 || first === null) return null;
      const body = firstIn(
        first,
        (index) =>
          text(bundle, index) === '{' && text(bundle, index - 1) === ')',
      );
      return insertAfter(source, bundle, body, 'this.kcpProbe();');
    },
  },
  {
    id: 'statement:setup',
    part: 'setup',
    describe: 'a global mixin added as a statement the module runs as it loads',
    apply: (source) => {
      const bundle = readBundle(source);
      const module = addSubject(bundle)?.module ?? null;
      return module === null
        ? null
        : insertAfter(source, bundle, module.body, 'kcpProbe.mixin({});');
    },
  },
  {
    id: 'declaration:setup',
    part: 'setup',
    describe: 'a global mixin made inside a declaration as the module loads',
    apply: (source) => {
      const bundle = readBundle(source);
      const module = addSubject(bundle)?.module ?? null;
      if (module === null) return null;
      const item = moduleItems(bundle, module).find(
        ({ span }) =>
          text(bundle, span.start) === 'var' &&
          text(bundle, span.start + 2) === '=',
      );
      if (item === undefined) return null;
      const equals = item.span.start + 2;
      const end =
        bundle.tokens[expressionEnd(bundle, equals + 1, item.span.end)];
      const after = bundle.tokens[equals];
      if (end === undefined || after === undefined) return null;
      const close = end.start;
      const open = after.start + after.text.length;
      return (
        source.slice(0, open) +
        '(kcpProbe.mixin({}),' +
        source.slice(open, close) +
        ')' +
        source.slice(close)
      );
    },
  },
  {
    id: 'route:setup',
    part: 'setup',
    describe: 'the pre registration route given another path',
    apply: (source) => {
      const bundle = readBundle(source);
      const path = stringsOf(bundle, '"/pre_registration"').find(
        (index) =>
          text(bundle, index - 2) === 'path' && text(bundle, index - 1) === ':',
      );
      return path === undefined
        ? null
        : replaceAt(source, bundle, path, '"/pre_registration_probe"');
    },
  },
  {
    id: 'label:labels',
    part: 'labels',
    describe: 'a changed English label of the add button',
    apply: (source) => {
      const bundle = readBundle(source);
      const component = addSubject(bundle);
      const catalogs =
        component === null ? null : catalogNames(bundle, component.module);
      if (component === null || catalogs === null) return null;
      const [english] = catalogOpens(bundle, component.module, catalogs);
      const value =
        english === undefined
          ? -1
          : valueIndex(bundle, english, ['pre_regis_add_subject', 'add']);
      return replaceAt(source, bundle, value, '"Add probe"');
    },
  },
];
