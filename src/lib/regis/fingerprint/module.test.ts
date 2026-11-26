import { describe, expect, it } from 'vitest';
import { analyseScopes } from './scopes';
import {
  PART_LIMITS,
  canonicalText,
  moduleOf,
  readBundle,
  type Bundle,
} from './module';

/** A bundle of one module function holding `body`, as the host's build emits it. */
function moduleBundle(body: string): Bundle {
  return readBundle(`(function(){var A={1:function(A,e,t){${body}}}})();`);
}

function indexOf(bundle: Bundle, text: string, from = 0): number {
  return bundle.tokens.findIndex(
    (token, index) => index >= from && token.text === text,
  );
}

/** The canonical text of the module definition `name` and all it reaches. */
function canonicalOf(
  body: string,
  name: string,
  boundary = new Map<string, string>(),
) {
  const bundle = moduleBundle(body);
  const module = moduleOf(bundle, indexOf(bundle, name, 10));
  const span = module?.definitions.get(name);
  if (module === null || span === undefined || span === null) {
    throw new Error(`no definition of ${name}`);
  }
  return canonicalText(bundle, module, [span], boundary);
}

describe('analyseScopes', () => {
  it('binds parameters, patterns, declarations, arrows, methods, and catch', () => {
    const source =
      'function(a,{b:c,d=x},...[f]){var g=1;let{h}=y;try{}catch(i){}return j=>a+c+d+f+g+h+i+j+k+{m(n){return n}}}';
    const tokens = readBundle(source);
    const table = analyseScopes(
      tokens.tokens,
      tokens.pairs,
      0,
      tokens.tokens.length,
    );
    const roleOf = (text: string, nth = 0) => {
      const matches = tokens.tokens
        .map((token, index) => (token.text === text ? index : -1))
        .filter((index) => index >= 0);
      return table.role(matches[nth] ?? -1);
    };
    for (const bound of ['a', 'c', 'd', 'f', 'g', 'h', 'i', 'j', 'n']) {
      expect(roleOf(bound).kind, bound).toBe('binding');
    }
    expect(roleOf('x')).toEqual({ kind: 'free', name: 'x' });
    expect(roleOf('k')).toEqual({ kind: 'free', name: 'k' });
    // The key b and the method name m are text, not bindings.
    expect(roleOf('b')).toEqual({ kind: 'text' });
    expect(roleOf('m')).toEqual({ kind: 'text' });
  });

  it('reads a property after a dot as text', () => {
    const bundle = readBundle('function(a){return a.b}');
    const table = analyseScopes(
      bundle.tokens,
      bundle.pairs,
      0,
      bundle.tokens.length,
    );
    expect(table.role(indexOf(bundle, 'b'))).toEqual({ kind: 'text' });
  });
});

describe('moduleOf', () => {
  it('collects the top level definitions and marks a name defined twice', () => {
    const bundle = moduleBundle(
      'var s=t(5),u=function(){return 1};function w(){}class K{}var s=2;',
    );
    const module = moduleOf(bundle, indexOf(bundle, 'u'));
    expect(module?.definitions.get('s')).toBeNull();
    expect(module?.definitions.has('u')).toBe(true);
    expect(module?.definitions.has('w')).toBe(true);
    expect(module?.definitions.has('K')).toBe(true);
  });

  it('finds no module outside a function', () => {
    const bundle = readBundle('var a=1;');
    expect(moduleOf(bundle, 0)).toBeNull();
  });
});

describe('canonicalText', () => {
  const helper = 'var q=function(x,y){return x.some(e=>e.end>y)},h=t(7);';

  it('reads the same when only minified names change', () => {
    const one = canonicalOf(
      `${helper}var r=function(a){return q(a,1)+h.A}`,
      'r',
    );
    const renamed = canonicalOf(
      'var Q=function(m,n){return m.some(z=>z.end>n)},H=t(7);var R=function(b){return Q(b,1)+H.A}',
      'R',
    );
    expect(renamed).toBe(one);
  });

  it('follows a free name to its definition, so a change there is a change', () => {
    const one = canonicalOf(`${helper}var r=function(a){return q(a,1)}`, 'r');
    const changed = canonicalOf(
      'var q=function(x,y){return x.some(e=>e.end>=y)};var r=function(a){return q(a,1)}',
      'r',
    );
    expect(changed).not.toBe(one);
  });

  it('labels each binding apart, so swapping two uses is a change', () => {
    const one = canonicalOf('var r=function(a,b){return a-b}', 'r');
    const swapped = canonicalOf('var r=function(a,b){return b-a}', 'r');
    expect(swapped).not.toBe(one);
  });

  it('names a boundary and does not follow it', () => {
    const text = canonicalOf(
      'var p={secret:1};var r=function(){return p}',
      'r',
      new Map([['p', 'catalog']]),
    );
    expect(text).toContain('=@catalog');
    expect(text).not.toContain('secret');
  });

  it('marks a name the module defines twice without guessing', () => {
    const text = canonicalOf('var p=1,p=2;var r=function(){return p}', 'r');
    expect(text).toContain('=?');
  });

  it('keeps a global as written, marked apart from the labels', () => {
    expect(canonicalOf('var r=function(){return window.open}', 'r')).toContain(
      '?window . open',
    );
  });

  it('tells two short globals apart, as it does two long ones', () => {
    const set = canonicalOf('var r=function(){return new Set}', 'r');
    const map = canonicalOf('var r=function(){return new Map}', 'r');
    expect(set).toContain('?Set');
    expect(map).not.toBe(set);
    expect(canonicalOf('var r=function(){return top.x}', 'r')).not.toBe(
      canonicalOf('var r=function(){return URL.x}', 'r'),
    );
  });

  it('keeps a wrapper parameter as written, so another one reads apart', () => {
    expect(canonicalOf('var r=function(){return t(5)}', 'r')).not.toBe(
      canonicalOf('var r=function(){return e(5)}', 'r'),
    );
  });

  it('gives up on a part that reaches more than the limits allow', () => {
    const chain = Array.from(
      { length: PART_LIMITS.segments + 1 },
      (_, index) => `var d${String(index)}=d${String(index + 1)};`,
    ).join('');
    expect(
      canonicalOf(`${chain}var d${String(PART_LIMITS.segments + 1)}=1;`, 'd0'),
    ).toBeNull();
  });
});
