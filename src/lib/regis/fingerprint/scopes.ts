// Which names in a stretch of the host's minified bundle are its own bindings and which
// reach outside it (ADR-0079). A minifier renames every local binding and may give one
// letter to two bindings in different scopes, so the fingerprint labels a name by the
// binding it refers to, not by its letters. Scopes are function scopes: a function, an
// arrow, a method, and a catch clause, with let and const counted in the function that
// holds them, which is how the host's minifier emits them. A name no scope in the
// stretch binds is free, and the module resolves it.

import type { Token } from './tokens.ts';

/** Words that are never a binding, kept as they are in the fingerprint. */
export const KEYWORDS = new Set([
  'arguments',
  'async',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'get',
  'if',
  'import',
  'in',
  'instanceof',
  'let',
  'new',
  'null',
  'of',
  'return',
  'set',
  'static',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'undefined',
  'var',
  'void',
  'while',
  'with',
  'yield',
]);

const CONTROL = new Set(['if', 'for', 'while', 'switch', 'with', 'catch']);
const METHOD_PREFIX = new Set([
  '{',
  ',',
  '}',
  ';',
  'static',
  'async',
  'get',
  'set',
  '*',
]);
const DECLARATION = new Set(['var', 'let', 'const']);

export interface Scope {
  start: number;
  end: number;
  parent: Scope | null;
  names: Map<string, number>;
}

/** What a name token is in the fingerprint: a binding, a free name, or kept text. */
export type NameRole =
  | { kind: 'binding'; id: number }
  | { kind: 'free'; name: string }
  | { kind: 'text' };

interface Context {
  tokens: readonly Token[];
  pairs: Int32Array;
}

function textAt(context: Context, index: number): string {
  return context.tokens[index]?.text ?? '';
}

function isPunct(context: Context, index: number, text: string): boolean {
  const token = context.tokens[index];
  return token?.kind === 'punct' && token.text === text;
}

function isOpener(context: Context, index: number): boolean {
  const token = context.tokens[index];
  return (
    token?.kind === 'punct' &&
    (token.text === '{' || token.text === '(' || token.text === '[')
  );
}

function isCloser(context: Context, index: number): boolean {
  const token = context.tokens[index];
  return (
    token?.kind === 'punct' &&
    (token.text === '}' || token.text === ')' || token.text === ']')
  );
}

/** Whether a name token is a property: after a dot, as a key, or as a method name. */
export function isPropertyName(context: Context, index: number): boolean {
  const before = textAt(context, index - 1);
  if (before === '.' || before === '?.') return true;
  const after = textAt(context, index + 1);
  if ((before === '{' || before === ',') && after === ':') return true;
  if (after === '(' && METHOD_PREFIX.has(before)) {
    const close = context.pairs[index + 1] ?? -1;
    return close > index && isPunct(context, close + 1, '{');
  }
  return false;
}

/**
 * The index just past an expression that starts at `index`: the first comma, semicolon,
 * or closing bracket outside any bracket, or a for loop's in or of when `head` is set.
 */
export function expressionEnd(
  context: Context,
  index: number,
  end: number,
  head = false,
): number {
  let at = index;
  while (at < end) {
    if (isOpener(context, at)) {
      at = (context.pairs[at] ?? end) + 1;
      continue;
    }
    if (
      isCloser(context, at) ||
      isPunct(context, at, ',') ||
      isPunct(context, at, ';')
    ) {
      return at;
    }
    const token = context.tokens[at];
    if (
      head &&
      token?.kind === 'name' &&
      (token.text === 'in' || token.text === 'of')
    )
      return at;
    at += 1;
  }
  return end;
}

class Binder {
  readonly scopes: Scope[] = [];
  private next = 0;
  private readonly context: Context;
  constructor(context: Context) {
    this.context = context;
  }

  scope(start: number, end: number): Scope {
    const scope: Scope = { start, end, parent: null, names: new Map() };
    this.scopes.push(scope);
    return scope;
  }

  bind(scope: Scope, index: number): void {
    const token = this.context.tokens[index];
    if (token?.kind !== 'name' || KEYWORDS.has(token.text)) return;
    if (!scope.names.has(token.text)) {
      scope.names.set(token.text, this.next);
      this.next += 1;
    }
  }

  /** Bind the names a pattern at `index` declares; returns the index past it. */
  pattern(scope: Scope, index: number, end: number): number {
    const { context } = this;
    const token = context.tokens[index];
    if (token?.kind === 'name') {
      this.bind(scope, index);
      return index + 1;
    }
    if (isPunct(context, index, '{') || isPunct(context, index, '[')) {
      const close = context.pairs[index] ?? end;
      this.elements(scope, index + 1, close, isPunct(context, index, '{'));
      return close + 1;
    }
    return index + 1;
  }

  /** The entries of an object pattern, or the elements of an array pattern or params. */
  elements(scope: Scope, start: number, close: number, object: boolean): void {
    const { context } = this;
    let at = start;
    while (at < close) {
      if (isPunct(context, at, ',')) {
        at += 1;
        continue;
      }
      if (isPunct(context, at, '...')) {
        at = this.pattern(scope, at + 1, close);
      } else if (object) {
        const keyEnd = isPunct(context, at, '[')
          ? (context.pairs[at] ?? close) + 1
          : at + 1;
        if (isPunct(context, keyEnd, ':'))
          at = this.pattern(scope, keyEnd + 1, close);
        else {
          this.bind(scope, at);
          at = keyEnd;
        }
      } else {
        at = this.pattern(scope, at, close);
      }
      if (isPunct(context, at, '=')) at = expressionEnd(context, at + 1, close);
      // Anything else up to the next comma is not a binding.
      while (at < close && !isPunct(context, at, ',')) at += 1;
    }
  }

  /** Bind the declarators of a var, let, or const at `index`. */
  declaration(scope: Scope, index: number, end: number): void {
    const { context } = this;
    const head =
      textAt(context, index - 1) === '(' &&
      textAt(context, index - 2) === 'for';
    let at = index + 1;
    for (;;) {
      at = this.pattern(scope, at, end);
      if (isPunct(context, at, '='))
        at = expressionEnd(context, at + 1, end, head);
      if (!isPunct(context, at, ',')) return;
      at += 1;
    }
  }
}

export interface ScopeTable {
  /** What the name token at `index` is, for the fingerprint. */
  role: (index: number) => NameRole;
  /** Whether the token at `index` sits in a function, so it runs only when called. */
  nested: (index: number) => boolean;
}

/** The scopes and bindings of the tokens in [start, end). */
export function analyseScopes(
  tokens: readonly Token[],
  pairs: Int32Array,
  start: number,
  end: number,
): ScopeTable {
  const context: Context = { tokens, pairs };
  const root: Scope = { start, end, parent: null, names: new Map() };
  const binder = new Binder(context);
  // Function scopes first, each with its parameter list, so a binding finds its scope.
  const params: [Scope, number, number][] = [];
  const catches: [Scope, number][] = [];
  for (let index = start; index < end; index += 1) {
    const token = tokens[index];
    if (token === undefined) break;
    if (
      token.kind === 'name' &&
      token.text === 'function' &&
      textAt(context, index - 1) !== '.'
    ) {
      let open = index + 1;
      if (isPunct(context, open, '*')) open += 1;
      if (tokens[open]?.kind === 'name') open += 1;
      const close = pairs[open] ?? -1;
      const body = close + 1;
      if (isPunct(context, open, '(') && isPunct(context, body, '{')) {
        params.push([binder.scope(open, pairs[body] ?? end), open, close]);
      }
    } else if (isPunct(context, index, '=>')) {
      const before = index - 1;
      const paramStart = isPunct(context, before, ')')
        ? (pairs[before] ?? before)
        : before;
      const bodyEnd = isPunct(context, index + 1, '{')
        ? (pairs[index + 1] ?? end)
        : expressionEnd(context, index + 1, end) - 1;
      const scope = binder.scope(paramStart, bodyEnd);
      if (isPunct(context, before, ')'))
        params.push([scope, paramStart, before]);
      else binder.bind(scope, before);
    } else if (isPunct(context, index, '(')) {
      const close = pairs[index] ?? -1;
      const body = close + 1;
      if (close < 0 || !isPunct(context, body, '{')) continue;
      const before = tokens[index - 1];
      if (before?.kind === 'name' && before.text === 'catch') {
        catches.push([binder.scope(index, pairs[body] ?? end), index]);
        continue;
      }
      const named =
        before?.kind === 'name' &&
        before.text !== 'function' &&
        !CONTROL.has(before.text) &&
        textAt(context, index - 2) !== 'function';
      const computed = before?.kind === 'punct' && before.text === ']';
      const quoted = before?.kind === 'string';
      if (named || computed || quoted) {
        params.push([binder.scope(index, pairs[body] ?? end), index, close]);
      }
    }
  }
  // One sweep gives each token its innermost scope and each scope its parent, since
  // the scopes nest: sorted by start, wider first, a stack holds the open ones.
  const sorted = [...binder.scopes].sort(
    (left, right) => left.start - right.start || right.end - left.end,
  );
  const holders: Scope[] = new Array<Scope>(end - start);
  const open: Scope[] = [root];
  let next = 0;
  for (let index = start; index < end; index += 1) {
    while (open.length > 1 && (open.at(-1)?.end ?? end) < index) open.pop();
    for (
      let scope = sorted[next];
      scope?.start === index;
      scope = sorted[next]
    ) {
      while (open.length > 1 && (open.at(-1)?.end ?? end) < scope.end)
        open.pop();
      scope.parent = open.at(-1) ?? root;
      open.push(scope);
      next += 1;
    }
    holders[index - start] = open.at(-1) ?? root;
  }
  const holderOf = (index: number): Scope => holders[index - start] ?? root;
  for (const [scope, open, close] of params)
    binder.elements(scope, open + 1, close, false);
  for (const [scope, open] of catches) binder.pattern(scope, open + 1, end);
  for (let index = start; index < end; index += 1) {
    const token = tokens[index];
    if (token?.kind !== 'name' || textAt(context, index - 1) === '.') continue;
    if (DECLARATION.has(token.text)) {
      binder.declaration(holderOf(index), index, end);
    } else if (token.text === 'function' || token.text === 'class') {
      const name = tokens[index + 1];
      if (name?.kind === 'name' && !KEYWORDS.has(name.text)) {
        binder.bind(holderOf(index), index + 1);
      }
    }
  }
  return {
    nested: (index) => holderOf(index) !== root,
    role: (index) => {
      const token = tokens[index];
      if (
        token?.kind !== 'name' ||
        KEYWORDS.has(token.text) ||
        isPropertyName(context, index)
      ) {
        return { kind: 'text' };
      }
      for (
        let scope: Scope | null = holderOf(index);
        scope !== null;
        scope = scope.parent
      ) {
        const id = scope.names.get(token.text);
        if (id !== undefined) return { kind: 'binding', id };
      }
      return { kind: 'free', name: token.text };
    },
  };
}
