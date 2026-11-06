import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import { buildManifest } from './manifest.config';

// See https://wxt.dev/api/config. The manifest is built in manifest.config.ts so
// every browser and mode is unit tested. Tailwind v4 emits its theme variables
// under ":root, :host", so tokens resolve inside the closed shadow root without
// any extra transform.
export default defineConfig({
  srcDir: 'src',
  // Manifest V3 for every target. WXT emits the Firefox appropriate background
  // shape (scripts rather than a service worker) from the single background
  // entrypoint.
  manifestVersion: 3,
  modules: ['@wxt-dev/module-react'],
  manifest: buildManifest,
  // The Firefox sources zip that AMO requires is produced by `wxt zip -b firefox`.
  // WXT already drops hidden paths and node_modules from the sources by default;
  // these globs also keep non hidden private working material and gitignored build
  // and test output out of the sources zip by construction, so a leak or a bloated
  // package cannot depend on remembering to delete a file or on a clean tree.
  zip: {
    excludeSources: [
      '**/CLAUDE.md',
      '.claude/**',
      '**/.claude/**',
      'temp/**',
      '**/temp/**',
      '.git/**',
      '**/.env*',
      '**/*.local',
      'coverage/**',
      'test-results/**',
      'playwright-report/**',
      'dist/**',
      'web-ext-artifacts/**',
      'stats.html',
    ],
  },
  vite: (env) => ({
    plugins: [tailwindcss()],
    define: {
      // Baked in literal so debug only modules dead code eliminate from
      // production output. Runtime code reads this through src/lib/env.ts.
      __KCP_DEBUG__: JSON.stringify(env.mode !== 'production'),
    },
  }),
});
