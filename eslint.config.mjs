import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import globals from 'globals';

const NO_FETCH = 'Network egress must go through the background gateway.';
const NO_HTML = 'Injecting HTML is forbidden; render through React nodes.';
const NO_FOCUS_LITERAL =
  'Write focus styles through FOCUS_RING or FOCUS_OUTLINE from lib/ui/focus (ADR-0034).';

// Raw HTML sinks, forbidden in every product source file.
const HTML_SYNTAX = [
  {
    selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
    message: NO_HTML,
  },
  {
    selector: "MemberExpression[property.name='innerHTML']",
    message: NO_HTML,
  },
  {
    selector: "MemberExpression[property.name='outerHTML']",
    message: NO_HTML,
  },
  {
    selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
    message: NO_HTML,
  },
];

// The page's own web storage, where the host keeps its session. KCP keeps its state in
// the extension storage, so no product file reads or writes either store (ADR-0075).
const NO_WEB_STORAGE =
  'KCP keeps its state in browser.storage; the page web storage holds the host session.';
const WEB_STORAGE_GLOBALS = ['sessionStorage', 'localStorage'].map((name) => ({
  name,
  message: NO_WEB_STORAGE,
}));
const WEB_STORAGE_PROPERTIES = ['window', 'globalThis', 'self'].flatMap(
  (object) =>
    ['sessionStorage', 'localStorage'].map((property) => ({
      object,
      property,
      message: NO_WEB_STORAGE,
    })),
);

// The raw host address, which can carry a token or a student id. Only the shell reader
// reads it, sanitized (ADR-0075). The guard covers the location object itself, so a
// destructuring, a toString, or a computed key cannot read around it, plus the other
// properties and events that expose the full address. A bare location global is held by
// the globals rule below, which resolves scope.
const NO_RAW_LOCATION =
  'Read the host address through features/shell/hostLocation, which sanitizes it.';
const LOCATION_SYNTAX = [
  {
    selector: "MemberExpression[property.name='location']",
    message: NO_RAW_LOCATION,
  },
  {
    selector: "MemberExpression[computed=true][property.value='location']",
    message: NO_RAW_LOCATION,
  },
  {
    selector:
      "MemberExpression[object.name='document'][property.name=/^(URL|documentURI|baseURI)$/]",
    message: NO_RAW_LOCATION,
  },
  {
    selector:
      'MemberExpression[property.name=/^(currentEntry|newURL|oldURL)$/]',
    message: NO_RAW_LOCATION,
  },
];
// A bare location read as a global, such as location.href or String(location). It holds
// the reader and the tests too, which reach the address through window.
const LOCATION_GLOBALS = [{ name: 'location', message: NO_RAW_LOCATION }];

// A focus ring or outline class written by hand, in a string or a template literal.
// The shared constants hold the one indicator, so the tokens change it in one place.
const FOCUS_CLASS = String.raw`/focus(-visible|-within)?:(ring|outline)/`;
const FOCUS_SYNTAX = [
  { selector: `Literal[value=${FOCUS_CLASS}]`, message: NO_FOCUS_LITERAL },
  {
    selector: `TemplateElement[value.raw=${FOCUS_CLASS}]`,
    message: NO_FOCUS_LITERAL,
  },
];

export default tseslint.config(
  {
    ignores: [
      '.wxt/**',
      '.output/**',
      '.wrangler/**',
      'coverage/**',
      'node_modules/**',
    ],
  },
  js.configs.recommended,

  // Type checked linting for product and test sources. The manifest builder is
  // product code at the root, so it gets the same rule set as src.
  {
    files: [
      'src/**/*.{ts,tsx}',
      'tests/**/*.{ts,tsx}',
      'scripts/**/*.ts',
      'manifest.config.ts',
    ],
    extends: [
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.browser },
    },
    rules: {
      // TypeScript resolves identifiers itself, so the core rule only produces
      // false positives on ambient globals.
      'no-undef': 'off',
    },
  },

  // React UI files. The react-hooks plugin is registered manually because its
  // v7 preset declares plugins as a string array, which flat config rejects.
  {
    files: ['src/**/*.tsx', 'tests/**/*.tsx'],
    extends: [
      reactPlugin.configs.flat.recommended,
      reactPlugin.configs.flat['jsx-runtime'],
      jsxA11y.flatConfigs.recommended,
    ],
    plugins: { 'react-hooks': reactHooks },
    // An explicit version avoids eslint-plugin-react 7 calling context APIs that
    // ESLint 10 removed during its React version auto detection.
    settings: { react: { version: '19.2.7' } },
    rules: {
      ...reactHooks.configs['recommended-latest'].rules,
      // A named region may be a tab stop so a keyboard can scroll content that holds
      // no control of its own, such as a wide table, which WCAG 2.1.1 requires.
      'jsx-a11y/no-noninteractive-tabindex': [
        'error',
        {
          tags: [],
          roles: ['tabpanel', 'region'],
          allowExpressionValues: true,
        },
      ],
    },
  },

  // Security rules that apply to every product source file.
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-eval': 'error',
      'no-new-func': 'error',
      'no-console': 'error',
      'no-restricted-syntax': [
        'error',
        ...HTML_SYNTAX,
        ...FOCUS_SYNTAX,
        ...LOCATION_SYNTAX,
      ],
      'no-restricted-globals': [
        'error',
        ...WEB_STORAGE_GLOBALS,
        ...LOCATION_GLOBALS,
      ],
      'no-restricted-properties': ['error', ...WEB_STORAGE_PROPERTIES],
    },
  },

  // The shell reader is the one place the raw address is read, and tests set and read
  // the address of the test document to drive the routes.
  {
    files: ['src/features/shell/hostLocation.ts', 'src/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error', ...HTML_SYNTAX, ...FOCUS_SYNTAX],
    },
  },

  // The focus module is the one place the focus classes are written, and its test
  // asserts them.
  {
    files: ['src/lib/ui/focus.ts', 'src/lib/ui/focus.test.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...HTML_SYNTAX, ...LOCATION_SYNTAX],
    },
  },

  // The logger is the single sanctioned console sink; the console is disabled
  // everywhere else by the security rules above.
  {
    files: ['src/lib/utils/logger.ts'],
    rules: { 'no-console': 'off' },
  },

  // The content script and feature UI never touch the network directly.
  {
    files: [
      'src/entrypoints/regis.content/**/*.{ts,tsx}',
      'src/features/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: NO_FETCH },
        ...WEB_STORAGE_GLOBALS,
        ...LOCATION_GLOBALS,
      ],
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'fetch', message: NO_FETCH },
        { object: 'globalThis', property: 'fetch', message: NO_FETCH },
        ...WEB_STORAGE_PROPERTIES,
      ],
    },
  },

  // End to end tests and the landing page capture run in Node and drive the built
  // extension. They need Node globals, and the Playwright fixture convention passes an
  // empty destructuring pattern for a fixture that depends on nothing, which is
  // allowed here.
  {
    files: ['tests/e2e/**/*.ts', 'scripts/landing/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      'no-empty-pattern': ['error', { allowObjectPatternsAsParameters: true }],
    },
  },

  // Root level config files use the TypeScript parser without type aware rules,
  // so untyped plugin configs do not trip the strict type checked rule set.
  {
    files: ['*.ts', '*.mts', '*.cts'],
    extends: [tseslint.configs.recommended],
    languageOptions: { globals: { ...globals.node } },
  },

  // Plain JavaScript and helper scripts run outside the type checked program.
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: { ...globals.node } },
  },

  // The landing site's one script runs in the visitor's browser.
  {
    files: ['site/**/*.js'],
    languageOptions: { globals: { ...globals.browser } },
  },

  // Must stay last so it can turn off rules that conflict with Prettier.
  eslintConfigPrettier,
);
