// A tokenizer for the host's minified bundle (ADR-0079). It reads the script as text and
// evaluates none of it: it splits the source into names, punctuators, numbers, strings,
// template chunks, and regular expression literals, and drops whitespace and comments.
// A slash starts a regular expression where the token before it cannot end an
// expression, the usual rule for minified code. Any text it cannot read, such as a
// string or a template that never closes, throws a TokenError, so a bundle KCP cannot
// read is a parse miss and never a guess. This module imports nothing, so the
// fingerprint script runs it in Node as the worker does.

export type TokenKind =
  'name' | 'punct' | 'number' | 'string' | 'template' | 'regex';

export interface Token {
  kind: TokenKind;
  text: string;
  /** Where the token starts in the source, for an edit at a known token. */
  start: number;
}

export class TokenError extends Error {
  constructor(at: number) {
    super(`unreadable script text at ${String(at)}`);
    this.name = 'TokenError';
  }
}

// Longest first, so a longer punctuator wins over its prefix.
const PUNCTUATORS = [
  '>>>=',
  '...',
  '===',
  '!==',
  '**=',
  '<<=',
  '>>=',
  '>>>',
  '&&=',
  '||=',
  '??=',
  '=>',
  '==',
  '!=',
  '<=',
  '>=',
  '&&',
  '||',
  '??',
  '?.',
  '++',
  '--',
  '+=',
  '-=',
  '*=',
  '/=',
  '%=',
  '&=',
  '|=',
  '^=',
  '**',
  '<<',
  '>>',
];

const SINGLE = new Set('{}()[];,<>+-*/%&|^!~?:=.@#');

/** Keywords after which a slash starts a regular expression. */
const BEFORE_EXPRESSION = new Set([
  'return',
  'typeof',
  'instanceof',
  'in',
  'of',
  'new',
  'delete',
  'void',
  'throw',
  'case',
  'do',
  'else',
  'yield',
  'await',
]);

function isNameStart(code: number): boolean {
  return (
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    code === 36 ||
    code === 95 ||
    code > 127
  );
}

function isNamePart(code: number): boolean {
  return isNameStart(code) || (code >= 48 && code <= 57);
}

function isDigit(code: number): boolean {
  return code >= 48 && code <= 57;
}

function regexAllowed(previous: Token | undefined): boolean {
  if (previous === undefined) return true;
  switch (previous.kind) {
    case 'name':
      return BEFORE_EXPRESSION.has(previous.text);
    case 'punct':
      return ![')', ']', '}'].includes(previous.text);
    case 'template':
      return previous.text.endsWith('${');
    default:
      return false;
  }
}

/** The index after a quoted string that opens at `start`. */
function stringEnd(source: string, start: number): number {
  const quote = source[start];
  for (let index = start + 1; index < source.length; index += 1) {
    const char = source[index];
    if (char === '\\') index += 1;
    else if (char === quote) return index + 1;
    else if (char === '\n') break;
  }
  throw new TokenError(start);
}

/** The index after a template chunk, which ends at a backtick or after a `${`. */
function templateEnd(source: string, start: number): number {
  for (let index = start + 1; index < source.length; index += 1) {
    const char = source[index];
    if (char === '\\') index += 1;
    else if (char === '`') return index + 1;
    else if (char === '$' && source[index + 1] === '{') return index + 2;
  }
  throw new TokenError(start);
}

function regexEnd(source: string, start: number): number {
  let inClass = false;
  for (let index = start + 1; index < source.length; index += 1) {
    const char = source[index];
    if (char === '\\') index += 1;
    else if (char === '\n') break;
    else if (char === '[') inClass = true;
    else if (char === ']') inClass = false;
    else if (char === '/' && !inClass) {
      let end = index + 1;
      while (end < source.length && isNamePart(source.charCodeAt(end))) {
        end += 1;
      }
      return end;
    }
  }
  throw new TokenError(start);
}

function numberEnd(source: string, start: number): number {
  let index = start;
  if (source[index] === '0' && /[xXoObB]/.test(source[index + 1] ?? '')) {
    index += 2;
    while (/[0-9a-fA-F_]/.test(source[index] ?? '')) index += 1;
    if (source[index] === 'n') index += 1;
    return index;
  }
  while (/[0-9_]/.test(source[index] ?? '')) index += 1;
  if (source[index] === '.') {
    index += 1;
    while (/[0-9_]/.test(source[index] ?? '')) index += 1;
  }
  if (/[eE]/.test(source[index] ?? '')) {
    index += 1;
    if (/[+-]/.test(source[index] ?? '')) index += 1;
    while (/[0-9_]/.test(source[index] ?? '')) index += 1;
  }
  if (source[index] === 'n') index += 1;
  return index;
}

function punctuatorAt(source: string, index: number): string {
  for (const candidate of PUNCTUATORS) {
    if (source.startsWith(candidate, index)) {
      // `?.5` is a conditional before a number, not optional chaining.
      if (candidate === '?.' && isDigit(source.charCodeAt(index + 2))) break;
      return candidate;
    }
  }
  const char = source[index] ?? '';
  if (!SINGLE.has(char)) throw new TokenError(index);
  return char;
}

/** Split a script into tokens. Throws a TokenError on text it cannot read. */
export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  // Each open brace, and whether it opened a template substitution.
  const braces: boolean[] = [];
  let index = 0;
  const push = (kind: TokenKind, end: number) => {
    tokens.push({ kind, text: source.slice(index, end), start: index });
    index = end;
  };
  while (index < source.length) {
    const char = source[index] ?? '';
    const code = source.charCodeAt(index);
    if (/\s/.test(char)) {
      index += 1;
    } else if (source.startsWith('//', index)) {
      const end = source.indexOf('\n', index);
      index = end < 0 ? source.length : end;
    } else if (source.startsWith('/*', index)) {
      const end = source.indexOf('*/', index + 2);
      if (end < 0) throw new TokenError(index);
      index = end + 2;
    } else if (char === '"' || char === "'") {
      push('string', stringEnd(source, index));
    } else if (char === '`') {
      const end = templateEnd(source, index);
      if (source.slice(end - 2, end) === '${') braces.push(true);
      push('template', end);
    } else if (char === '}' && braces.at(-1) === true) {
      braces.pop();
      const end = templateEnd(source, index);
      if (source.slice(end - 2, end) === '${') braces.push(true);
      push('template', end);
    } else if (
      isDigit(code) ||
      (char === '.' && isDigit(source.charCodeAt(index + 1)))
    ) {
      push('number', numberEnd(source, index));
    } else if (
      isNameStart(code) ||
      (char === '#' && isNameStart(source.charCodeAt(index + 1)))
    ) {
      let end = index + 1;
      while (end < source.length && isNamePart(source.charCodeAt(end)))
        end += 1;
      push('name', end);
    } else if (char === '/' && regexAllowed(tokens.at(-1))) {
      push('regex', regexEnd(source, index));
    } else {
      const text = punctuatorAt(source, index);
      if (text === '{') braces.push(false);
      else if (text === '}' && braces.pop() === undefined)
        throw new TokenError(index);
      push('punct', index + text.length);
    }
  }
  if (braces.length > 0) throw new TokenError(source.length);
  return tokens;
}

/**
 * The index of the bracket that closes each opening bracket, and of the one that opens
 * each closing bracket, for `{}`, `()`, and `[]`. Throws a TokenError on a mismatch.
 */
export function matchBrackets(tokens: readonly Token[]): Int32Array {
  const pairs = new Int32Array(tokens.length).fill(-1);
  const open: number[] = [];
  const CLOSER: Readonly<Record<string, string>> = {
    '}': '{',
    ')': '(',
    ']': '[',
  };
  tokens.forEach((token, index) => {
    if (token.kind !== 'punct') return;
    if (token.text === '{' || token.text === '(' || token.text === '[') {
      open.push(index);
      return;
    }
    const expected = CLOSER[token.text];
    if (expected === undefined) return;
    const start = open.pop();
    if (start === undefined || tokens[start]?.text !== expected) {
      throw new TokenError(index);
    }
    pairs[start] = index;
    pairs[index] = start;
  });
  if (open.length > 0) throw new TokenError(tokens.length);
  return pairs;
}
