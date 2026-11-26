// The host bundle as one module scope, and the canonical text of a part with everything
// it reaches (ADR-0079). The host's build hoists its pages into one module function, so
// a part's free names are that module's top level definitions. The canonical text labels
// every binding by its order, so a build that renames nothing but minified names reads
// the same, and it follows each free name to its definition, so a change in a helper the
// part calls is a change in the part. A free name that names another part is written as
// that part and not followed, so each part has its own fingerprint.

import { analyseScopes, expressionEnd } from './scopes.ts';
import { matchBrackets, tokenize, type Token } from './tokens.ts';

export interface Bundle {
  tokens: Token[];
  pairs: Int32Array;
  /** The innermost bracket that holds each token, or -1 at the top. */
  parents: Int32Array;
}

export interface Span {
  start: number;
  /** Exclusive. */
  end: number;
}

export interface ModuleScope {
  body: number;
  /** Each top level name and its definition, or null when the name is defined twice. */
  definitions: Map<string, Span | null>;
}

/** The most a part may reach, so a bundle KCP cannot bound is a parse miss. */
export const PART_LIMITS = { segments: 600, tokens: 400_000 };

export function readBundle(source: string): Bundle {
  const tokens = tokenize(source);
  const pairs = matchBrackets(tokens);
  const parents = new Int32Array(tokens.length).fill(-1);
  const open: number[] = [];
  tokens.forEach((token, index) => {
    parents[index] = open.at(-1) ?? -1;
    if (token.kind !== 'punct') return;
    if (token.text === '{' || token.text === '(' || token.text === '[')
      open.push(index);
    else if (token.text === '}' || token.text === ')' || token.text === ']')
      open.pop();
  });
  return { tokens, pairs, parents };
}

function text(bundle: Bundle, index: number): string {
  return bundle.tokens[index]?.text ?? '';
}

/** Whether the brace at `index` opens the body of a function written with `function`. */
function isFunctionBody(bundle: Bundle, index: number): boolean {
  if (text(bundle, index) !== '{' || text(bundle, index - 1) !== ')')
    return false;
  const open = bundle.pairs[index - 1] ?? -1;
  const before = open - 1;
  return (
    text(bundle, before) === 'function' ||
    text(bundle, before - 1) === 'function'
  );
}

/** The body brace of the function that holds the token at `index`, or -1. */
function enclosingFunction(bundle: Bundle, index: number): number {
  for (
    let at = bundle.parents[index] ?? -1;
    at >= 0;
    at = bundle.parents[at] ?? -1
  ) {
    if (isFunctionBody(bundle, at)) return at;
  }
  return -1;
}

function define(
  definitions: Map<string, Span | null>,
  name: string,
  span: Span,
): void {
  definitions.set(name, definitions.has(name) ? null : span);
}

/** The module scope that holds the token at `index`: its top level definitions. */
export function moduleOf(bundle: Bundle, index: number): ModuleScope | null {
  const body = enclosingFunction(bundle, index);
  if (body < 0) return null;
  const close = bundle.pairs[body] ?? -1;
  const definitions = new Map<string, Span | null>();
  const context = { tokens: bundle.tokens, pairs: bundle.pairs };
  for (let at = body + 1; at < close; at += 1) {
    if (bundle.parents[at] !== body) continue;
    const token = bundle.tokens[at];
    if (token?.kind !== 'name' || text(bundle, at - 1) === '.') continue;
    if (token.text === 'function' || token.text === 'class') {
      const name = bundle.tokens[at + 1];
      let brace = at + 2;
      while (
        brace < close &&
        !(text(bundle, brace) === '{' && bundle.parents[brace] === body)
      ) {
        brace =
          text(bundle, brace) === '('
            ? (bundle.pairs[brace] ?? close) + 1
            : brace + 1;
      }
      if (name?.kind === 'name') {
        define(definitions, name.text, {
          start: at,
          end: (bundle.pairs[brace] ?? close) + 1,
        });
      }
    } else if (
      token.text === 'var' ||
      token.text === 'let' ||
      token.text === 'const'
    ) {
      let declarator = at + 1;
      for (;;) {
        const name = bundle.tokens[declarator];
        let next = declarator + 1;
        if (name?.kind !== 'name') {
          // A destructuring declaration defines names KCP does not follow.
          next = (bundle.pairs[declarator] ?? declarator) + 1;
        }
        if (text(bundle, next) === '=') {
          const end = expressionEnd(context, next + 1, close);
          if (name?.kind === 'name')
            define(definitions, name.text, { start: next + 1, end });
          next = end;
        }
        if (text(bundle, next) !== ',') break;
        declarator = next + 1;
      }
    }
  }
  return { body, definitions };
}

/** A name a part reaches: the part it belongs to, or nothing to follow. */
export type Boundary = ReadonlyMap<string, string>;

/**
 * The canonical text of the spans of a part and of every definition they reach, or null
 * when the part reaches more than PART_LIMITS allow. A part found inside a larger
 * function names that function as `within`, so its bindings are read in their scopes.
 */
export function canonicalText(
  bundle: Bundle,
  module: ModuleScope,
  roots: readonly Span[],
  boundary: Boundary,
  within?: Span,
): string | null {
  // Free names in order of first use; each followed definition is queued with its label.
  const free = new Map<string, string>();
  const queue: { span: Span; label: string; scope: Span }[] = roots.map(
    (span) => ({ span, label: '', scope: within ?? span }),
  );
  const lines: string[] = [];
  let tokens = 0;
  const labelOf = (name: string): string => {
    const known = free.get(name);
    if (known !== undefined) return known;
    const label = `f${String(free.size)}`;
    free.set(name, label);
    const part = boundary.get(name);
    const definition = module.definitions.get(name);
    if (part !== undefined) lines.push(`${label}=@${part}`);
    else if (definition === null) lines.push(`${label}=?`);
    else if (definition !== undefined) {
      queue.push({ span: definition, label, scope: definition });
    }
    return label;
  };
  // The queue grows as definitions are reached; the loop reads what it adds.
  for (const { span, label, scope } of queue) {
    tokens += span.end - span.start;
    if (queue.length > PART_LIMITS.segments || tokens > PART_LIMITS.tokens) {
      return null;
    }
    const table = analyseScopes(
      bundle.tokens,
      bundle.pairs,
      scope.start,
      scope.end,
    );
    const words: string[] = label === '' ? [] : [`${label}=`];
    for (let index = span.start; index < span.end; index += 1) {
      const token = bundle.tokens[index];
      if (token === undefined) break;
      const role = table.role(index);
      if (role.kind === 'binding') words.push(`v${String(role.id)}`);
      else if (role.kind === 'free') {
        // A long free name the module does not define is a global, kept as written.
        const follow =
          boundary.has(role.name) ||
          module.definitions.has(role.name) ||
          role.name.length < 4;
        words.push(follow ? labelOf(role.name) : role.name);
      } else words.push(token.text);
    }
    lines.push(words.join(' '));
  }
  return lines.join('\n');
}
