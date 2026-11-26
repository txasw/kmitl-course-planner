import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fingerprintScript } from './fingerprint';
import { canonicalText, moduleOf, readBundle, type Bundle } from './module';
import { moduleItems, setupRoots, storeSpan } from './setup';

/** A bundle of one module function holding `body`, as the host's build emits it. */
function moduleBundle(body: string): Bundle {
  return readBundle(`(function(){var A={1:function(A,e,t){${body}}}})();`);
}

function moduleIn(bundle: Bundle) {
  // The first token of the module body, just past the wrapper's `(A,e,t){`.
  const at = bundle.tokens.findIndex(
    (token, index) =>
      token.text === '{' && bundle.tokens[index - 2]?.text === 't',
  );
  const module = moduleOf(bundle, at + 1);
  if (module === null) throw new Error('no module');
  return module;
}

function itemTexts(body: string): string[] {
  const bundle = moduleBundle(body);
  return moduleItems(bundle, moduleIn(bundle)).map(
    ({ declaration, span }) =>
      `${declaration ? 'd' : 's'}:${bundle.tokens
        .slice(span.start, span.end)
        .map((token) => token.text)
        .join('')}`,
  );
}

/** The setup part's canonical text of a module body, with `pages` as page names. */
function setupText(body: string, pages: string[] = []): string | null {
  const bundle = moduleBundle(body);
  const module = moduleIn(bundle);
  const setup = setupRoots(bundle, module, new Set(pages));
  const boundary = new Map(setup.boundary);
  for (const page of pages) boundary.set(page, 'page');
  return canonicalText(bundle, module, setup.roots, boundary, {
    replacements: setup.replacements,
  });
}

describe('moduleItems', () => {
  it('splits the module into its declarations and its statements', () => {
    expect(
      itemTexts(
        't(1),t(2);var a=t(3),b=function(){return 1};function c(){}class D{}async function g(){}if(a){b()}a.use(b);let h=2',
      ),
    ).toEqual([
      's:t(1),t(2)',
      'd:vara=t(3),b=function(){return1}',
      'd:functionc(){}',
      'd:classD{}',
      'd:asyncfunctiong(){}',
      's:if(a){b()}',
      's:a.use(b)',
      'd:leth=2',
    ]);
  });

  it('keeps an else with its if, and an object followed by in as one', () => {
    expect(itemTexts('if(a){b()}else{c()};x={}in y;var z=1')).toEqual([
      's:if(a){b()}else{c()}',
      's:x={}iny',
      'd:varz=1',
    ]);
  });
});

describe('storeSpan', () => {
  it('reads the one store, and none when two are built', () => {
    const one = moduleBundle('var Z=new x.y.Store({state:{}});');
    const module = moduleIn(one);
    expect(storeSpan(module, ['Z'])).not.toBeNull();
    expect(storeSpan(module, ['Z', 'Y'])).toBeNull();
    expect(storeSpan(module, [])).toBeNull();
  });
});

describe('setupRoots', () => {
  it('reads every statement and follows what it names', () => {
    const text = setupText('var m={a:1};s.Ay.use(p);s.Ay.mixin(m);');
    expect(text).toContain('. use (');
    expect(text).toContain('. mixin (');
    expect(text).toContain('{ a : 1 }');
  });

  it('reads a declaration that installs something as it is made, and no other', () => {
    expect(setupText('var q=(s.Ay.mixin({x:1}),2);')).toContain('mixin');
    expect(setupText('var q=function(){s.Ay.mixin({x:1})};')).toBe('');
    expect(setupText('var q=()=>s.Ay.use(p);')).toBe('');
  });

  it('reads a declaration whose value makes a call, a new, or a write', () => {
    for (const value of [
      '(document.addEventListener("click",()=>{},!0),0)',
      'window.fetch("/api/",{method:"POST"})',
      '(document.onclick=function(){},0)',
      'fetch`/api/`',
      '(()=>{g()})()',
      'import("x")',
      'delete window.fetch',
      'new K',
    ]) {
      const text = setupText(
        `class K{constructor(){this.x=h()}}var q=${value};`,
      );
      expect(text, value).not.toBe('');
      expect(text, value).not.toBeNull();
    }
  });

  it('leaves out what the build writes around every component', () => {
    const app =
      'var Ao={name:"App"},Ar=function(){return 1},Ac=(0,N.A)(Ao,Ar,[],!1,null,null,null),Ae=Ac.exports;';
    for (const body of [
      'var a=t(12),b=t.n(a);',
      `${app}var Bo={name:"B"},Bc=(0,N.A)(Bo,Ar,[],!1,null,null,null);`,
      'class K{}var c=new K;',
      'class K{m(){fetch("/api/")}}class L extends K{constructor(A){super("u")}}var c=new L;',
      'var x={delete:1,new:2},y=["1","2"];',
    ]) {
      expect(setupText(body), body).toBe('');
    }
    expect(
      setupText(`${app}var Bc=(0,N.B)({},null,[],!1,null,null,null);`),
    ).toContain('. B )');
    expect(
      setupText('class K{constructor(){fetch("/a")}}var c=new K;'),
    ).toContain('fetch');
  });

  it('reads each running declarator alone, and a helper made in a pattern', () => {
    expect(setupText('var a=s.Ay.mixin({}),b={staff:1};')).not.toContain(
      'staff',
    );
    const helper = (name: string, page: string) =>
      `var {mapFields:${name}}=(0,x.y)({getterType:"a/b"}),P={computed:{...${name}({${page}:"k"})}};`;
    const text = setupText(helper('Hs', 'config'));
    expect(text).toContain('{ mapFields : @bound } = ( 0 , ?x . y )');
    expect(text).not.toContain('computed');
    expect(setupText(helper('Zq', 'other'))).toBe(text);
    expect(setupText('var {a:b=g()}=(0,x.y)({});')).toContain('g (');
  });

  it('leaves the route table as a boundary and reads the page routes in full', () => {
    const body =
      'var P=[{path:"/staff",name:"staff",component:W},{path:"/pre_registration",name:"pre_registration",component:G}],R=new l.Ay({routes:P});R.beforeEach(((A,e,t)=>t()));';
    const text = setupText(body, ['G']);
    expect(text).toContain('=@routes');
    expect(text).toContain('"/pre_registration"');
    expect(text).not.toContain('"/staff"');
    expect(setupText(body.replace('"/staff"', '"/other"'), ['G'])).toBe(text);
    expect(
      setupText(body.replace('"/pre_registration",', '"/pre_reg",'), ['G']),
    ).not.toBe(text);
  });

  it('leaves the lists of route names the guard reads as boundaries', () => {
    const body =
      'var P=[{path:"/",name:"home",component:W},{path:"/a",name:"staff_a",component:W}],R=new l.Ay({routes:P});const L=["home","staff_a","gone"],M=[...L,"staff_a"],N=["not_a_route"],E=[];function O(A){return L.some(e=>A.includes(e))||M.length||N.length||E.length}R.beforeEach(((A,e,t)=>O([A.name])?t():t("/")));';
    const text = setupText(body) ?? '';
    expect(text.match(/=@routeNames/g)).toHaveLength(2);
    expect(text).toContain('"not_a_route"');
    expect(text).toContain('[ ]');
    expect(setupText(body.replace('"gone"', '"staff_b"'))).toBe(text);
    expect(setupText(body.replace('L.some', 'L.every'))).not.toBe(text);
  });
});

describe('the setup and store parts on the replica bundle', () => {
  const replica = readFileSync(
    resolve(process.cwd(), 'tests/fixtures/host-fingerprint/app.replica.js'),
    'utf8',
  );

  it('sees a message key in the App root in the setup and not in the labels', async () => {
    const edited = replica.replace(
      'e("router-view")',
      'e("router-view"),A.$t("drawer.home")',
    );
    expect(edited).not.toBe(replica);
    const before = await fingerprintScript(replica);
    const after = await fingerprintScript(edited);
    expect(after?.setup).not.toBe(before?.setup);
    expect(after?.labels).toBe(before?.labels);
    expect(after?.store).toBe(before?.store);
  });

  it('sees a store module that sends a request when a mutation runs', async () => {
    const edited = replica.replace(
      'setReady(A,e){A.ready=e}',
      'setReady(A,e){A.ready=e,fetch("/api/",{method:"POST"})}',
    );
    expect(edited).not.toBe(replica);
    const before = await fingerprintScript(replica);
    const after = await fingerprintScript(edited);
    expect(after?.store).not.toBe(before?.store);
    expect(after?.setup).toBe(before?.setup);
  });
});
