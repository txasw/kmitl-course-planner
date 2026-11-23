import { describe, expect, it, vi } from 'vitest';
import { ESLint, Linter } from 'eslint';

// The guards of ADR-0075 live in the lint config, so this test asserts they apply where
// they must and fires them on small sources. The rule settings are read from the
// config the repository lints with, then run on plain JavaScript, which needs no type
// information, so the test proves the configured rules rather than a copy of them.

const GUARDED = [
  'no-restricted-globals',
  'no-restricted-properties',
  'no-restricted-imports',
] as const;
const SYNTAX = 'no-restricted-syntax';

const eslint = new ESLint();

// Resolving the repository config loads every plugin, which takes seconds on its own and
// longer while the whole suite runs in parallel, so this file allows more than the default.
vi.setConfig({ testTimeout: 60_000 });

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

// The registration helper reads the host page and never acts on it (ADR-0077).
const HOST_ACTIONS = [
  'el.dispatchEvent(new Event("input", { bubbles: true }));',
  'button.click();',
  'form.submit();',
  'form.requestSubmit();',
  'input.value = "01476107";',
  'option.selected = true;',
  'el.focus();',
  'el.setAttribute("aria-selected", "true");',
  'export const key = new KeyboardEvent("keydown");',
  'export const press = new MouseEvent("click");',
];

describe('the host action guard', () => {
  it.each([
    'src/features/regis/host/hostDom.ts',
    'src/features/regis/ChecklistRow.tsx',
    'src/lib/regis/checklist.ts',
    'src/entrypoints/regis.content/index.tsx',
  ])('forbids acting on a host control in %s', async (file) => {
    for (const source of HOST_ACTIONS) {
      const messages = await messagesFor(file, source);
      expect(messages.join(' ')).toMatch(/only reads the host page/);
    }
  });

  it('leaves the tests free to build their fixture pages', async () => {
    for (const source of HOST_ACTIONS) {
      expect(
        await messagesFor('src/features/regis/host/hostDom.test.ts', source),
      ).toEqual([]);
    }
  });
});

describe('the host reading egress guard', () => {
  it.each([
    'src/features/regis/host/hostDom.ts',
    'src/features/regis/host/useHostObserver.ts',
    'src/lib/regis/hostObservation.ts',
    'src/lib/regis/observedRow.ts',
  ])('keeps host readings out of storage and messages in %s', async (file) => {
    for (const source of [
      'import { x } from "@/lib/storage/regis";',
      'import { x } from "@/lib/messaging/protocol";',
      'import { logger } from "@/lib/utils/logger";',
      'import { x } from "@/features/diagnostics/store";',
      'import { x } from "../../lib/storage/repo";',
    ]) {
      const messages = await messagesFor(file, source);
      expect(messages.join(' ')).toMatch(/stay in memory/);
    }
  });
});

describe('the surrogate presence check', () => {
  it('is the one place the session store is read', async () => {
    const file = 'src/features/regis/host/surrogate.ts';
    expect(
      await messagesFor(
        file,
        'sessionStorage.getItem("surrogated_student_id");',
      ),
    ).toEqual([]);
    const local = await messagesFor(file, 'localStorage.getItem("x");');
    expect(local.join(' ')).toMatch(/browser\.storage/);
    const elsewhere = await messagesFor(
      'src/features/regis/host/hostDom.ts',
      'sessionStorage.getItem("surrogated_student_id");',
    );
    expect(elsewhere.join(' ')).toMatch(/browser\.storage/);
  });
});

// The fill actuator is the one module that may act on a host control (ADR-0078).
describe('the fill actuator confinement', () => {
  const actuator = 'src/features/regis/fill/hostActuator.ts';

  it('lets the actuator dispatch, click, and write the field', async () => {
    for (const source of [
      'el.dispatchEvent(new Event("input", { bubbles: true }));',
      'el.dispatchEvent(new MouseEvent("click", { bubbles: true }));',
      'button.click();',
      'input.value = "01476107";',
    ]) {
      expect(await messagesFor(actuator, source)).toEqual([]);
    }
  });

  it('still forbids the actuator every other action', async () => {
    for (const source of [
      'export const key = new KeyboardEvent("keydown");',
      'el.focus();',
      'form.submit();',
      'form.requestSubmit();',
      'option.selected = true;',
      'el.setAttribute("aria-selected", "true");',
    ]) {
      const messages = await messagesFor(actuator, source);
      expect(messages.join(' ')).toMatch(/only writes the field/);
    }
  });

  it.each([
    'src/features/regis/fill/hostControls.ts',
    'src/features/regis/fill/fillEngine.ts',
    'src/features/regis/fill/FillControls.tsx',
    'src/lib/regis/fillPlan.ts',
  ])('forbids acting on a host control in %s', async (file) => {
    for (const source of HOST_ACTIONS) {
      const messages = await messagesFor(file, source);
      expect(messages.join(' ')).toMatch(/only reads the host page/);
    }
  });
});

describe('the student press issuer', () => {
  const source = 'import { issueStudentPress } from "./studentPress";';

  it('is imported by the fill buttons only', async () => {
    expect(
      await messagesFor('src/features/regis/fill/FillControls.tsx', source),
    ).toEqual([]);
    for (const file of [
      'src/features/regis/fill/fillEngine.ts',
      'src/features/regis/fill/hostControls.ts',
      'src/features/regis/DockContent.tsx',
      'src/entrypoints/regis.content/App.tsx',
    ]) {
      const messages = await messagesFor(file, source);
      expect(messages.join(' ')).toMatch(/Only the fill buttons/);
    }
  });

  it('leaves the press type and its consumer free to import', async () => {
    expect(
      await messagesFor(
        'src/features/regis/fill/fillEngine.ts',
        'import { consumeStudentPress } from "./studentPress";',
      ),
    ).toEqual([]);
  });

  it('keeps the fill engine out of storage and messages', async () => {
    const messages = await messagesFor(
      'src/features/regis/fill/fillEngine.ts',
      'import { x } from "@/lib/storage/regis";',
    );
    expect(messages.join(' ')).toMatch(/stay in memory/);
  });
});
