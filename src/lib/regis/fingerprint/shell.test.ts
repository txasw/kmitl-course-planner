import { describe, expect, it } from 'vitest';
import { canonicalText, moduleOf, readBundle, type Bundle } from './module';
import { setupRoots } from './setup';
import { shellComponents } from './shell';

/** A bundle of one module function holding `body`, as the host's build emits it. */
function moduleBundle(body: string): Bundle {
  return readBundle(`(function(){var A={1:function(A,e,t){${body}}}})();`);
}

function moduleIn(bundle: Bundle) {
  const at = bundle.tokens.findIndex(
    (token, index) =>
      token.text === '{' && bundle.tokens[index - 2]?.text === 't',
  );
  const module = moduleOf(bundle, at + 1);
  if (module === null) throw new Error('no module');
  return module;
}

interface ShellShape {
  /** The drawer's options, with DATA where its data value goes. */
  options?: string;
  data?: string;
  render?: string;
  /** The key the App registers the drawer under. */
  key?: string;
  scope?: string;
  /** Statements the module runs before the root instance. */
  extra?: string;
}

const MENU =
  '{nav:[{to:"home",label:"drawer.home",icon:"mdi-home",active:!1}]}';

/** A module with a root instance, its App, and one component the App registers. */
function shellBody(shape: ShellShape = {}): string {
  const {
    options = 'data:()=>(DATA),methods:{go(){return this.$emit("go")}}',
    data = MENU,
    render = 'e("nav",{attrs:{role:"menu"}})',
    key = 'Drawer',
    scope = '"0a1b2c3d"',
    extra = '',
  } = shape;
  return [
    'var N=t(1);',
    `var Dr=function(){var A=this,e=A._self._c;return ${render}},`,
    `Dp={${options.replace('DATA', data)}},`,
    `Dc=(0,N.A)(Dp,Dr,[],!1,null,${scope},null),De=Dc.exports;`,
    `var Ao={name:"App",components:{${key}:De}},`,
    'Ar=function(){var A=this,e=A._self._c;return e("div",[e("router-view")])},',
    'Ac=(0,N.A)(Ao,Ar,[],!1,null,null,null),Ae=Ac.exports;',
    extra,
    'new V({render:A=>A(Ae)}).$mount("#app");',
  ].join('');
}

/** The setup part's canonical text of a shell module. */
function setupOf(shape: ShellShape = {}): string | null {
  const bundle = moduleBundle(shellBody(shape));
  const module = moduleIn(bundle);
  const setup = setupRoots(bundle, module, new Set());
  return canonicalText(bundle, module, setup.roots, new Map(setup.boundary), {
    replacements: setup.replacements,
  });
}

describe('shellComponents', () => {
  it('finds the App and each shell component it registers', () => {
    const bundle = moduleBundle(shellBody());
    const found = shellComponents(bundle, moduleIn(bundle));
    expect(found.map((component) => component.key)).toEqual(['App', 'Drawer']);
    expect(found.every((component) => component.options !== null)).toBe(true);
  });

  it('finds no shell without an App', () => {
    const bundle = moduleBundle(shellBody().replace('name:"App"', 'name:"X"'));
    expect(shellComponents(bundle, moduleIn(bundle))).toEqual([]);
  });
});

describe('the shell data boundary', () => {
  it('writes the menu data and the scoped style id as one word each', () => {
    const text = setupOf() ?? '';
    expect(text).toContain('data : ( ) => ( { nav : @data } )');
    expect(text).toContain('@scope');
    expect(text).not.toContain('drawer.home');
    expect(text).not.toContain('0a1b2c3d');
  });

  it('reads a regrouped menu, a new label, and a changed icon the same', () => {
    const base = setupOf();
    for (const data of [
      '{nav:[{to:"home",label:"drawer.home",icon:"mdi-account",active:!1}]}',
      '{nav:[{to:"x",label:"drawer.new",icon:"mdi-x",active:!0},{to:"home",label:"drawer.home",icon:"mdi-home",n:-1,s:null,t:`plain`,list:["a",1,!0,false]}]}',
      '{nav:[{label:"drawer.home",subItems:[{to:"home"},...[{to:"more"}]]}]}',
    ]) {
      expect(setupOf({ data }), data).toBe(base);
    }
    expect(setupOf({ scope: '"9f8e7d6c"' })).toBe(base);
  });

  it('reads the same in each way a data function returns its value', () => {
    const arrow = setupOf({ options: 'data:()=>(DATA)' });
    const other = '{nav:[{to:"other"}]}';
    expect(setupOf({ options: 'data:()=>(DATA)', data: other })).toBe(arrow);
    for (const options of [
      'data(){return DATA}',
      'data:function(){return DATA;}',
    ]) {
      expect(setupOf({ options }), options).toBe(
        setupOf({ options, data: other }),
      );
    }
  });

  it('reads a choice on a module constant as data', () => {
    const extra = 'var Fl=!1;';
    const choice = (label: string) =>
      `{nav:[{to:"home"},...Fl?[{to:"staff",label:"${label}"}]:[]]}`;
    expect(setupOf({ extra, data: choice('drawer.a') })).toBe(
      setupOf({ extra, data: choice('drawer.b') }),
    );
    expect(setupOf({ extra, data: choice('drawer.a') })).toContain(
      'data : ( ) => ( { nav : @data } )',
    );
  });

  it('keeps in full a data entry that holds no pure data', () => {
    for (const entry of [
      '{to:"x",run:function(){return 1}}',
      '{to:"x",run:()=>1}',
      '{to:"x",run:g()}',
      '{to:"x",run:N.y}',
      '{to:"x",run:Q}',
      '{to:"x",run:`a${1}`}',
      '{to:"x",get run(){return 1}}',
      '{to:"x",[k]:1}',
      '{to:"x",...q?[1]:[]}',
    ]) {
      const data = `{nav:[{to:"home"},${entry}]}`;
      expect(setupOf({ data }), entry).not.toBe(
        setupOf({ data: data.replace('"x"', '"z"') }),
      );
      expect(setupOf({ data }), entry).toContain('nav : [ @data ,');
    }
  });

  it('keeps every literal of a method and of the render function', () => {
    const method = (value: string) =>
      `data:()=>(DATA),methods:{go(){return this.$store.dispatch(${value})}}`;
    expect(setupOf({ options: method('["a/b"]') })).not.toBe(
      setupOf({ options: method('["a/c"]') }),
    );
    expect(setupOf({ render: 'e("nav",{attrs:{role:"menu"}})' })).not.toBe(
      setupOf({ render: 'e("nav",{attrs:{role:"list"}})' }),
    );
    expect(setupOf({ scope: 'null' })).not.toBe(setupOf());
  });

  it('keeps in full a drawer data key beside the menu', () => {
    // Vue sets a data key over a method or a computed value of the same name.
    for (const extra of ['student_id:"65010001",', 'logout:"x",']) {
      const data = `{${extra}nav:[{to:"home"}]}`;
      expect(setupOf({ data }), extra).toContain(extra.slice(0, 6));
      expect(setupOf({ data }), extra).not.toBe(
        setupOf({ data: data.replace('"home"', '"other"') }),
      );
    }
    expect(setupOf({ data: '{nav:[{to:"home"}],extra:[1]}' })).not.toBe(
      setupOf({ data: '{nav:[{to:"home"}],extra:[2]}' }),
    );
  });

  it('keeps the data of the app bar and of the footer in full', () => {
    // The app bar binds its `attrs` onto a button, so a literal there is an attribute.
    const bar = (attrs: string) =>
      setupOf({ key: 'AppBar', data: `{on:null,attrs:${attrs}}` });
    expect(bar('{onanimationstart:"go()"}')).not.toBe(bar('null'));
    expect(bar('{href:"javascript:void 0"}')).not.toBe(bar('null'));
    expect(setupOf({ key: 'AppBar', scope: '"9f8e7d6c"' })).not.toBe(
      setupOf({ key: 'AppBar' }),
    );
    expect(setupOf({ key: 'Footer', data: '{a:[1]}' })).not.toBe(
      setupOf({ key: 'Footer', data: '{a:[2]}' }),
    );
  });

  it('keeps the data in full outside the shell', () => {
    const other = '{nav:[{to:"other"}]}';
    expect(setupOf({ key: 'Sidebar' })).not.toBe(
      setupOf({ key: 'Sidebar', data: other }),
    );
    const param = 'data:(A)=>(DATA)';
    expect(setupOf({ options: param })).not.toBe(
      setupOf({ options: param, data: other }),
    );
    const mixin = (value: string) =>
      `var Pg={data:()=>({x:["${value}"]})};V.mixin(Pg);`;
    expect(setupOf({ extra: mixin('a') })).not.toBe(
      setupOf({ extra: mixin('b') }),
    );
  });
});
