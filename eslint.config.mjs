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

// The registration helper reads the host page and never acts on it (ADR-0077): no event
// dispatch, no click, no submit, no value written into a control, no focus moved, and no
// event constructed, so nothing in these folders can press a host control. Each action
// is matched as any reference to its member, computed or destructured, and each event
// as a bare or a namespaced constructor, so a call through `.call`, `Reflect.apply`, a
// string key, or `window.MouseEvent` is caught as well as a plain call.
const NO_HOST_ACTION =
  'The registration helper only reads the host page; it never acts on a host control.';
const ACTION_METHODS =
  'submit|requestSubmit|focus|reset|showModal|showPopover|togglePopover|setRangeText|setAttribute|setAttributeNS|removeAttribute|toggleAttribute';
const STATE_PROPERTIES =
  'checked|selected|textContent|innerText|disabled|hidden|indeterminate';
const EVENT_TYPES =
  'Event|CustomEvent|InputEvent|KeyboardEvent|MouseEvent|PointerEvent|FocusEvent|SubmitEvent';
const KEY_EVENT_TYPES =
  'KeyboardEvent|InputEvent|PointerEvent|FocusEvent|SubmitEvent';

function actionSyntax(methods, properties, events, message) {
  return [
    `MemberExpression[property.name=/^(${methods})$/]`,
    `MemberExpression[computed=true][property.value=/^(${methods})$/]`,
    `ObjectPattern > Property[key.name=/^(${methods})$/]`,
    `AssignmentExpression[left.property.name=/^(${properties})$/]`,
    `AssignmentExpression[left.property.value=/^(${properties})$/]`,
    "CallExpression[callee.object.name='Object'][callee.property.name=/^(assign|defineProperty|defineProperties)$/]",
    "CallExpression[callee.object.name='Reflect'][callee.property.name=/^(set|defineProperty)$/]",
    `NewExpression[callee.name=/^(${events})$/]`,
    `NewExpression[callee.property.name=/^(${events})$/]`,
  ].map((selector) => ({ selector, message }));
}

const HOST_ACTION_SYNTAX = actionSyntax(
  `dispatchEvent|click|${ACTION_METHODS}`,
  `value|${STATE_PROPERTIES}`,
  EVENT_TYPES,
  NO_HOST_ACTION,
);

// The fill actuator is the one module that may act on a host control (ADR-0078): it may
// dispatch an event, click, and write a field value, and nothing else on this list.
const ACTUATOR_SYNTAX = actionSyntax(
  ACTION_METHODS,
  STATE_PROPERTIES,
  KEY_EVENT_TYPES,
  'The fill actuator only writes the field, dispatches input, and clicks.',
);

// Only a fill button's click handler may issue the student press that starts a run.
const PRESS_ISSUER = {
  group: ['**/studentPress'],
  importNames: ['issueStudentPress'],
  message: 'Only the fill buttons issue a student press (ADR-0078).',
};

// Modules that read the host page keep what they read in memory: they may not reach the
// storage, the worker messaging, the logger, or the diagnostics (ADR-0077).
const NO_HOST_EGRESS =
  'Host page readings stay in memory; this module may not import storage, messaging, the logger, or diagnostics.';
const HOST_EGRESS_PATTERNS = [
  '@/lib/storage/**',
  '@/lib/messaging/**',
  '@/lib/utils/logger',
  '@/features/diagnostics/**',
  '**/storage/**',
  '**/messaging/**',
  '**/logger',
  '**/diagnostics/**',
];

// The shared shell, plan, search, planner, and catalog modules, the core message protocol,
// the gateway, and the web app stay free of registration code, so the web build reaches
// none of it: the helper fills the slots they read instead (ADR-0080). A type import
// carries no code and stays allowed.
const NO_REGIS =
  'Shared modules may not import registration code; read a slot the helper fills instead (ADR-0080).';
const REGIS_IMPORT = {
  group: ['**/regis/**'],
  allowTypeImports: true,
  message: NO_REGIS,
};
const REGIS_FREE = [
  'src/features/shell/**/*.{ts,tsx}',
  'src/features/plans/**/*.{ts,tsx}',
  'src/features/search/**/*.{ts,tsx}',
  'src/features/planner/**/*.{ts,tsx}',
  'src/features/catalog/**/*.{ts,tsx}',
  'src/lib/messaging/protocol.ts',
  'src/lib/api/**/*.{ts,tsx}',
  'src/web/**/*.{ts,tsx}',
];
const REGIS_EXCEPTIONS = [
  // The launcher hosts the helper's ready state and route, and the web never mounts it.
  'src/features/shell/Launcher.tsx',
  // The worker side host check (ADR-0079), which only the extension background imports.
  'src/lib/api/hostCheck.ts',
  'src/lib/api/hostScript.ts',
];
// These still read the route classifier, quiet mode, and the host check names from
// lib/regis, which move out of it in their own changes and take these entries with them.
// Each file may import only the names it reads today; any other regis import is refused.
const REGIS_MOVES_PENDING = [
  {
    file: 'src/features/shell/quietRoute.ts',
    imports: { '@/lib/regis/route': ['isRegistrationRoute'] },
  },
  {
    file: 'src/features/search/useSearchController.ts',
    imports: { '@/lib/regis/quietMode': ['automaticReferenceRead'] },
  },
  {
    file: 'src/lib/messaging/protocol.ts',
    imports: {
      '../regis/buildVerdict': ['hostBuildVerdictSchema'],
      '../regis/hostContract': ['APP_SCRIPT_NAME', 'VENDOR_SCRIPT_NAME'],
    },
  },
];

// The regis patterns with the named modules taken out of the general refusal and limited
// to the names listed for them.
function regisPatternsAllowing(imports) {
  const modules = Object.keys(imports);
  return [
    {
      ...REGIS_IMPORT,
      group: [...REGIS_IMPORT.group, ...modules.map((module) => `!${module}`)],
    },
    ...modules.map((module) => ({
      group: [module],
      allowImportNames: imports[module],
      allowTypeImports: true,
      message: NO_REGIS,
    })),
  ];
}

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
      // A minified stand in for the host's app script, which the host check tests read
      // as text and never run.
      'tests/fixtures/host-fingerprint/**',
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

  // The registration helper and the content entry read the host page and never act on
  // it. Tests set up their fixture documents, so they are exempt.
  {
    files: [
      'src/features/regis/**/*.{ts,tsx}',
      'src/lib/regis/**/*.ts',
      'src/entrypoints/regis.content/**/*.{ts,tsx}',
    ],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...HTML_SYNTAX,
        ...FOCUS_SYNTAX,
        ...LOCATION_SYNTAX,
        ...HOST_ACTION_SYNTAX,
      ],
    },
  },

  // The fill actuator acts on the host controls its handles name, and only that way.
  {
    files: ['src/features/regis/fill/hostActuator.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...HTML_SYNTAX,
        ...FOCUS_SYNTAX,
        ...LOCATION_SYNTAX,
        ...ACTUATOR_SYNTAX,
      ],
    },
  },

  // No product module but the fill buttons may issue a student press.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}', 'src/features/regis/fill/FillControls.tsx'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [PRESS_ISSUER] }],
    },
  },

  // The shared modules stay free of registration code. The press issuer rule rides
  // along, since this setting replaces the one above for these files.
  {
    files: REGIS_FREE,
    ignores: ['**/*.test.{ts,tsx}', ...REGIS_EXCEPTIONS],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [REGIS_IMPORT, PRESS_ISSUER] },
      ],
    },
  },
  ...REGIS_MOVES_PENDING.map(({ file, imports }) => ({
    files: [file],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [...regisPatternsAllowing(imports), PRESS_ISSUER] },
      ],
    },
  })),

  // The host page readers and the fill engine keep what they read in memory only.
  {
    files: [
      'src/features/regis/host/**/*.{ts,tsx}',
      'src/features/regis/fill/**/*.{ts,tsx}',
      'src/lib/regis/host*.ts',
      'src/lib/regis/observ*.ts',
      'src/lib/regis/fill*.ts',
    ],
    ignores: ['**/*.test.{ts,tsx}', 'src/features/regis/fill/FillControls.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: HOST_EGRESS_PATTERNS, message: NO_HOST_EGRESS },
            PRESS_ISSUER,
          ],
        },
      ],
    },
  },

  // The one read of the page web storage: whether the staff surrogate key is present,
  // so the observer stays off on a page that belongs to another person (ADR-0077).
  {
    files: [
      'src/features/regis/host/surrogate.ts',
      'src/features/regis/host/surrogate.test.ts',
    ],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: NO_FETCH },
        { name: 'localStorage', message: NO_WEB_STORAGE },
        ...LOCATION_GLOBALS,
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

  // The landing site's one script and the host page replica run in a browser.
  {
    files: ['site/**/*.js', 'tests/e2e/host/**/*.js'],
    languageOptions: { globals: { ...globals.browser } },
  },

  // Must stay last so it can turn off rules that conflict with Prettier.
  eslintConfigPrettier,
);
