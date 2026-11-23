import { describe, expect, it } from 'vitest';
import { ESLint, Linter } from 'eslint';

// The guards of ADR-0075 live in the lint config, so this test asserts they apply where
// they must and fires them on small sources. The rule settings are read from the
// config the repository lints with, then run on plain JavaScript, which needs no type
// information, so the test proves the configured rules rather than a copy of them.

const GUARDED = ['no-restricted-globals', 'no-restricted-properties'] as const;
const SYNTAX = 'no-restricted-syntax';

const eslint = new ESLint();

async function rulesFor(file: string): Promise<Linter.RulesRecord> {
  // ESLint types the calculated config loosely; the rules record is the part read here.
  const config = (await eslint.calculateConfigForFile(file)) as {
    rules: Linter.RulesRecord;
  };
  return config.rules;
}

async function messagesFor(file: string, source: string): Promise<string[]> {
  const all = await rulesFor(file);
  const rules: Linter.RulesRecord = {};
  for (const name of [...GUARDED, SYNTAX]) {
    const setting = all[name];
    if (setting !== undefined) rules[name] = setting;
  }
  const linter = new Linter();
  return linter
    .verify(source, [
      {
        languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
        rules,
      },
    ])
    .map((message) => message.message);
}

const STORAGE_SOURCES = [
  'sessionStorage.getItem("token");',
  'localStorage.setItem("kcp", "1");',
  'window.sessionStorage.clear();',
  'globalThis.localStorage.getItem("x");',
];

const LOCATION_SOURCES = [
  'export const hash = window.location.hash;',
  'export const both = document.location.href + globalThis.location.hash;',
  'export const { hash } = window.location;',
  'export const query = window["location"].search;',
  'export const page = document.URL;',
  'export const entry = navigation.currentEntry;',
  'addEventListener("hashchange", (event) => event.newURL);',
];

describe('the web storage guard', () => {
  it.each([
    'src/lib/planner/conflicts.ts',
    'src/features/shell/Launcher.tsx',
    'src/entrypoints/background.ts',
    'src/entrypoints/regis.content/index.tsx',
  ])('forbids the page web storage in %s', async (file) => {
    for (const source of STORAGE_SOURCES) {
      const messages = await messagesFor(file, source);
      expect(messages.join(' ')).toMatch(/browser\.storage/);
    }
  });

  it('keeps the network guard beside it in the feature code', async () => {
    const messages = await messagesFor(
      'src/features/search/SearchForm.tsx',
      'fetch("https://example.com");',
    );
    expect(messages.join(' ')).toMatch(/background gateway/);
  });
});

// A bare location global is forbidden in every file, the reader and tests included,
// since each of them reaches the address through window.
const BARE_LOCATION = [
  'export const href = location.href;',
  'export const text = String(location);',
];

describe('the raw address guard', () => {
  it.each([
    'src/features/search/useHashRoute.ts',
    'src/features/shell/useBackToClose.ts',
    'src/lib/routing/locationHash.ts',
    'src/lib/ui/focus.ts',
  ])('forbids a raw address read in %s', async (file) => {
    for (const source of [...LOCATION_SOURCES, ...BARE_LOCATION]) {
      const messages = await messagesFor(file, source);
      expect(messages.join(' ')).toMatch(/hostLocation/);
    }
  });

  it('allows the one shell reader and the tests', async () => {
    for (const file of [
      'src/features/shell/hostLocation.ts',
      'src/features/shell/hostLocation.test.tsx',
    ]) {
      for (const source of LOCATION_SOURCES) {
        expect(await messagesFor(file, source)).toEqual([]);
      }
    }
  });

  it('forbids a bare location global even in the reader and the tests', async () => {
    for (const file of [
      'src/features/shell/hostLocation.ts',
      'src/features/shell/hostLocation.test.tsx',
    ]) {
      for (const source of BARE_LOCATION) {
        const messages = await messagesFor(file, source);
        expect(messages.join(' ')).toMatch(/hostLocation/);
      }
    }
  });

  it('leaves other uses of the names alone', async () => {
    const messages = await messagesFor(
      'src/lib/utils/download.ts',
      'const link = { href: "" }; link.href = "x"; const url = new URL("https://a"); url.hash; function at(location) { return `${location}.x`; }',
    );
    expect(messages).toEqual([]);
  });
});
