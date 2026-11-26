// The host labels the companion depends on (ADR-0079). Two sets, both read as text and
// never evaluated. The first is every label the host gives a clickable element in its
// registration dictionaries, in both of its languages: what scripts/host-labels.mjs
// prints for the fill denylist. The second is the value, in each language, of every
// message key a fingerprinted part names, which holds the fixed labels the observer
// matches. The part's text lists both, sorted, so their order in the bundle does not
// matter and a changed, added, or removed label does.

import type { Bundle, ModuleScope } from './module.ts';

const CLICKABLE =
  /on:\{click:[^[]{0,400}?\}\},\[\w+\._v\((?:"\s*"\+)?\w+\._s\(\w+\.\$t\("([\w.]+)"\)/g;

const REGISTRATION = /^(pre_regis|registration|regis_|queue_table)/;

/** A message key as the host writes one: lower case words joined by dots. */
const MESSAGE_KEY = /"([a-z0-9_]+(?:\.[a-z0-9_]+)+)"/g;

function blockEnd(text: string, start: number): number {
  let depth = 0;
  for (let index = text.indexOf('{', start); index < text.length; index += 1) {
    if (text[index] === '{') depth += 1;
    else if (text[index] === '}' && --depth === 0) return index;
  }
  return text.length;
}

function clickableValues(source: string, key: string): string[] {
  const [namespace = '', leaf = ''] = key.split('.');
  const found: string[] = [];
  const blocks = new RegExp(`[,{]${namespace}:[{]`, 'g');
  for (const match of source.matchAll(blocks)) {
    const block = source.slice(match.index, blockEnd(source, match.index));
    const value = new RegExp(`[,{]${leaf}:"([^"]{1,60})"`).exec(block);
    if (value?.[1] !== undefined) found.push(value[1].trim());
  }
  return found;
}

/**
 * Every label the host gives a clickable element in a registration dictionary, in both
 * of its languages, sorted. A label is a message key that is the only text child of an
 * element with a click handler, resolved in every dictionary block of its namespace.
 */
export function clickableLabels(source: string): string[] {
  const keys = new Set(
    [...source.matchAll(CLICKABLE)]
      .map((match) => match[1] ?? '')
      .filter((key) => REGISTRATION.test(key)),
  );
  const labels = [...keys].flatMap((key) => clickableValues(source, key));
  return [...new Set(labels)].sort();
}

/** The token index of a dotted key's string value in an object literal, or -1. */
export function valueIndex(
  bundle: Bundle,
  open: number,
  path: readonly string[],
): number {
  const [head, ...rest] = path;
  const close = bundle.pairs[open] ?? -1;
  for (let at = open + 1; at < close; at += 1) {
    const isKey =
      bundle.parents[at] === open &&
      bundle.tokens[at - 1]?.text !== ':' &&
      bundle.tokens[at]?.text === head &&
      bundle.tokens[at + 1]?.text === ':';
    if (!isKey) continue;
    const value = bundle.tokens[at + 2];
    if (rest.length === 0) return value?.kind === 'string' ? at + 2 : -1;
    return value?.text === '{' ? valueIndex(bundle, at + 2, rest) : -1;
  }
  return -1;
}

/** The opening brace of each catalog definition, English first. */
export function catalogOpens(
  bundle: Bundle,
  module: ModuleScope,
  catalogs: readonly string[],
): number[] {
  return catalogs.slice(1).flatMap((name) => {
    const span = module.definitions.get(name);
    return span !== undefined &&
      span !== null &&
      bundle.tokens[span.start]?.text === '{'
      ? [span.start]
      : [];
  });
}

/**
 * The label part's text: each message key the parts name with its value in each
 * catalog, then the clickable registration labels.
 */
export function labelsText(
  bundle: Bundle,
  module: ModuleScope,
  source: string,
  catalogs: readonly string[],
  partTexts: readonly string[],
): string {
  const opens = catalogOpens(bundle, module, catalogs);
  const keys = new Set(
    partTexts.flatMap((text) =>
      [...text.matchAll(MESSAGE_KEY)].map((match) => match[1] ?? ''),
    ),
  );
  const entries: string[] = [];
  for (const key of [...keys].sort()) {
    const values = opens.map((open) => {
      const index = valueIndex(bundle, open, key.split('.'));
      return index < 0 ? null : (bundle.tokens[index]?.text ?? null);
    });
    if (values.some((value) => value !== null)) {
      entries.push(`${key}=${values.map((value) => value ?? '-').join('|')}`);
    }
  }
  return [...entries, '', ...clickableLabels(source)].join('\n');
}
