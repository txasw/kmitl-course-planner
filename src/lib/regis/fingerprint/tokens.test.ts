import { describe, expect, it } from 'vitest';
import { TokenError, matchBrackets, tokenize } from './tokens';

function kinds(source: string) {
  return tokenize(source).map((token) => [token.kind, token.text]);
}

describe('tokenize', () => {
  it('splits names, punctuators, numbers, and strings, and drops comments', () => {
    expect(kinds('var a=1e3/* note */,b="x\\"y";// end')).toEqual([
      ['name', 'var'],
      ['name', 'a'],
      ['punct', '='],
      ['number', '1e3'],
      ['punct', ','],
      ['name', 'b'],
      ['punct', '='],
      ['string', '"x\\"y"'],
      ['punct', ';'],
    ]);
  });

  it('reads a slash as a regular expression only where an expression starts', () => {
    expect(kinds('a=b/c/d')).toEqual([
      ['name', 'a'],
      ['punct', '='],
      ['name', 'b'],
      ['punct', '/'],
      ['name', 'c'],
      ['punct', '/'],
      ['name', 'd'],
    ]);
    expect(kinds('a=/[/]}/g.test(b)').slice(2, 3)).toEqual([
      ['regex', '/[/]}/g'],
    ]);
    expect(kinds('return/x/').at(-1)).toEqual(['regex', '/x/']);
  });

  it('keeps a template with substitutions in chunks, braces balanced', () => {
    expect(kinds('`a${{b:1}.b}c${d}`')).toEqual([
      ['template', '`a${'],
      ['punct', '{'],
      ['name', 'b'],
      ['punct', ':'],
      ['number', '1'],
      ['punct', '}'],
      ['punct', '.'],
      ['name', 'b'],
      ['template', '}c${'],
      ['name', 'd'],
      ['template', '}`'],
    ]);
  });

  it('records where each token starts', () => {
    expect(tokenize('  ab =c').map((token) => token.start)).toEqual([2, 5, 6]);
  });

  it('tells optional chaining from a conditional before a number', () => {
    expect(kinds('a?.b')[1]).toEqual(['punct', '?.']);
    expect(kinds('a?.5:1')[1]).toEqual(['punct', '?']);
  });

  it.each([
    ['an unclosed string', '"abc'],
    ['an unclosed template', '`abc${d'],
    ['an unclosed comment', 'a /* b'],
    ['a stray closing brace', 'a}'],
    ['a character no script holds', 'a\u0000b'],
  ])('throws a TokenError on %s', (_name, source) => {
    expect(() => tokenize(source)).toThrow(TokenError);
  });
});

describe('matchBrackets', () => {
  it('pairs each bracket with the one that closes it', () => {
    const tokens = tokenize('f(a,[b],{c:d})');
    const pairs = matchBrackets(tokens);
    expect(pairs[1]).toBe(tokens.length - 1);
    expect(pairs[tokens.length - 1]).toBe(1);
    expect(tokens[pairs[4] ?? 0]?.text).toBe(']');
  });

  it('throws a TokenError on brackets that do not match', () => {
    expect(() => matchBrackets(tokenize('f(a]'))).toThrow(TokenError);
    expect(() => matchBrackets(tokenize('f(a'))).toThrow(TokenError);
  });
});
