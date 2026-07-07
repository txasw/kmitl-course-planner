import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import globals from 'globals';

const NO_FETCH = 'Network egress must go through the background gateway.';
const NO_HTML = 'Injecting HTML is forbidden; render through React nodes.';

export default tseslint.config(
  {
    ignores: ['.wxt/**', '.output/**', 'coverage/**', 'node_modules/**'],
  },
  js.configs.recommended,

  // Type checked linting for product and test sources.
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
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
    rules: { ...reactHooks.configs['recommended-latest'].rules },
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
      ],
    },
  },

  // The content script and feature UI never touch the network directly.
  {
    files: [
      'src/entrypoints/regis.content/**/*.{ts,tsx}',
      'src/features/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-globals': ['error', { name: 'fetch', message: NO_FETCH }],
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'fetch', message: NO_FETCH },
        { object: 'globalThis', property: 'fetch', message: NO_FETCH },
      ],
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

  // Must stay last so it can turn off rules that conflict with Prettier.
  eslintConfigPrettier,
);
