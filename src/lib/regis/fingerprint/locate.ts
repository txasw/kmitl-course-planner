// Finding the parts of the host bundle by what they are rather than where they sit
// (ADR-0079). A page component is found by the name its options give it, and the call
// that binds its options to its render function. The grade not announced dialog is the
// call inside the add subject card's render function that the flag opening it names.
// The period check is the mixins the PreRegistration route takes. The API client is the
// one class with no superclass that holds the host's request instance. The message
// catalogs are the map of the two languages the host's i18n takes, and the store is the
// one built with new Store. Each finder returns null, or nothing, when what it looks for
// is missing or not alone, so a part KCP cannot place is a part it does not have.

import {
  moduleOf,
  type Bundle,
  type ModuleScope,
  type Span,
} from './module.ts';

/** The flag the add subject card opens the grade not announced dialog with. */
const GRADE_DIALOG_FLAG = '"confirm_grade_not_announce_dialog"';

export function text(bundle: Bundle, index: number): string {
  return bundle.tokens[index]?.text ?? '';
}

export interface Component {
  module: ModuleScope;
  /** The call that binds the options to the render function. */
  call: Span;
  /** The render function, for a part found inside it. */
  render: Span | null;
  /** The options object, for a part its options name. */
  options: Span;
  /** The module names that stand for this component. */
  names: Set<string>;
}

/** Each place a string token with exactly this text sits, by index. */
export function stringsOf(bundle: Bundle, literal: string): number[] {
  const found: number[] = [];
  bundle.tokens.forEach((token, index) => {
    if (token.kind === 'string' && token.text === literal) found.push(index);
  });
  return found;
}

/** The module definition whose span is exactly the one token `name`, as `a=b` is. */
function aliasesOf(
  module: ModuleScope,
  bundle: Bundle,
  name: string,
): string[] {
  const aliases: string[] = [];
  for (const [alias, span] of module.definitions) {
    if (
      span !== null &&
      span.end - span.start === 1 &&
      text(bundle, span.start) === name
    ) {
      aliases.push(alias);
    }
  }
  return aliases;
}

export function locateComponent(
  bundle: Bundle,
  name: string,
): Component | null {
  const keys = stringsOf(bundle, `"${name}"`).filter(
    (index) =>
      text(bundle, index - 1) === ':' && text(bundle, index - 2) === 'name',
  );
  if (keys.length !== 1) return null;
  const key = (keys[0] ?? 0) - 2;
  const open = bundle.parents[key] ?? -1;
  if (text(bundle, open) !== '{' || text(bundle, open - 1) !== '=') return null;
  const module = moduleOf(bundle, open);
  const optionsName = text(bundle, open - 2);
  const options = module?.definitions.get(optionsName);
  if (module === null || options?.start !== open) return null;
  const names = new Set([
    optionsName,
    ...aliasesOf(module, bundle, optionsName),
  ]);
  let call: [string, Span] | null = null;
  for (const [binding, span] of module.definitions) {
    if (span === null) continue;
    const at = (offset: number) => text(bundle, span.start + offset);
    const isCall =
      at(0) === '(' &&
      at(1) === '0' &&
      at(2) === ',' &&
      at(4) === '.' &&
      at(6) === ')' &&
      at(7) === '(' &&
      names.has(at(8)) &&
      at(9) === ',';
    if (!isCall) continue;
    if (call !== null) return null;
    call = [binding, span];
  }
  if (call === null) return null;
  const [callName, callSpan] = call;
  names.add(callName);
  for (const [binding, span] of module.definitions) {
    if (
      span !== null &&
      span.end - span.start === 3 &&
      text(bundle, span.start) === callName &&
      text(bundle, span.start + 2) === 'exports'
    ) {
      names.add(binding);
    }
  }
  const render =
    module.definitions.get(text(bundle, callSpan.start + 10)) ?? null;
  return { module, call: callSpan, render, options, names };
}

/** The call expression of the grade not announced dialog inside a render function. */
export function gradeDialogSpan(bundle: Bundle, render: Span): Span | null {
  const flags = stringsOf(bundle, GRADE_DIALOG_FLAG).filter(
    (index) =>
      index > render.start &&
      index < render.end &&
      text(bundle, index - 1) === ':' &&
      text(bundle, index - 2) === 'expression',
  );
  if (flags.length !== 1) return null;
  for (
    let at = bundle.parents[flags[0] ?? 0] ?? -1;
    at > render.start;
    at = bundle.parents[at] ?? -1
  ) {
    if (text(bundle, at) === '(' && bundle.tokens[at - 1]?.kind === 'name') {
      return { start: at - 1, end: (bundle.pairs[at] ?? at) + 1 };
    }
  }
  return null;
}

/** The method or function that holds a token: from its name, or `async`, to its end. */
export function enclosingMethod(bundle: Bundle, index: number): Span | null {
  for (
    let at = bundle.parents[index] ?? -1;
    at >= 0;
    at = bundle.parents[at] ?? -1
  ) {
    if (text(bundle, at) !== '{' || text(bundle, at - 1) !== ')') continue;
    const open = bundle.pairs[at - 1] ?? -1;
    if (bundle.tokens[open - 1]?.kind !== 'name') continue;
    let start = open - 1;
    if (
      text(bundle, start - 1) === 'async' ||
      text(bundle, start - 1) === 'function'
    )
      start -= 1;
    return { start, end: (bundle.pairs[at] ?? at) + 1 };
  }
  return null;
}

/** The message catalog map `{en:a,th:b}`: its name, then the English and Thai catalogs. */
export function catalogNames(
  bundle: Bundle,
  module: ModuleScope,
): string[] | null {
  let found: string[] | null = null;
  for (const [name, span] of module.definitions) {
    if (span === null || span.end - span.start !== 9) continue;
    const at = (offset: number) => text(bundle, span.start + offset);
    const shaped =
      at(0) === '{' &&
      at(2) === ':' &&
      at(4) === ',' &&
      at(6) === ':' &&
      at(8) === '}';
    const locales = new Map([
      [at(1), at(3)],
      [at(5), at(7)],
    ]);
    const en = locales.get('en');
    const th = locales.get('th');
    if (!shaped || en === undefined || th === undefined) continue;
    if (found !== null) return null;
    found = [name, en, th];
  }
  return found;
}

/** The host store, built with `new x.y.Store(...)`, which a part names and never follows. */
export function storeNames(bundle: Bundle, module: ModuleScope): string[] {
  const names: string[] = [];
  for (const [name, span] of module.definitions) {
    if (span === null) continue;
    const at = (offset: number) => text(bundle, span.start + offset);
    if (at(0) === 'new' && at(5) === 'Store' && at(6) === '(') names.push(name);
  }
  return names;
}

/** The one class with no superclass that holds the host's request instance. */
export function clientSpan(bundle: Bundle, module: ModuleScope): Span | null {
  let found: Span | null = null;
  for (const span of module.definitions.values()) {
    if (
      span === null ||
      text(bundle, span.start) !== 'class' ||
      text(bundle, span.start + 2) !== '{'
    ) {
      continue;
    }
    let holds = false;
    for (let at = span.start; at < span.end && !holds; at += 1) {
      holds =
        text(bundle, at) === 'axiosInstance' && text(bundle, at - 1) === '.';
    }
    if (!holds) continue;
    if (found !== null) return null;
    found = span;
  }
  return found;
}

/** The definitions the PreRegistration route takes as mixins. */
export function periodMixins(
  bundle: Bundle,
  route: Component | undefined,
): Span[] {
  if (route === undefined) return [];
  const spans: Span[] = [];
  for (let at = route.options.start; at < route.options.end; at += 1) {
    if (
      text(bundle, at) !== 'mixins' ||
      text(bundle, at + 1) !== ':' ||
      bundle.parents[at] !== route.options.start
    ) {
      continue;
    }
    const close = bundle.pairs[at + 2] ?? at;
    for (let item = at + 3; item < close; item += 2) {
      const span = route.module.definitions.get(text(bundle, item));
      if (span === undefined || span === null) return [];
      spans.push(span);
    }
  }
  return spans;
}
