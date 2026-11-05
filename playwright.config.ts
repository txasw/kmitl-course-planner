import { defineConfig } from '@playwright/test';
import type { TestOptions } from './tests/e2e/support/fixtures';

// The smoke project reads the built production manifest off disk. The debug and
// production projects load the matching built extension: debug for the open
// shadow root the browser driven specs need, production for the isolation
// assertions. The extension directory is resolved against the working directory
// by the fixtures, so relative paths are enough here. Extension contexts are
// heavy, so runs stay serial.

// The desktop size every existing spec runs and passes at. It sits in the xl tier
// of ADR-0048, where the catalog column, with the search form at its head, docks
// beside the grid. The fixture forwards it to the extension context; a spec that
// needs another desktop size sets it with test.use.
const DESKTOP = { width: 1440, height: 900 };

// The phone and tablet projects load the debug build for locator access and run
// only the specs named for them, so the desktop suite never repeats at small
// sizes and a small screen spec never runs at desktop width. The suffixes are
// disjoint from .debug.spec.ts, so no project needs an ignore list.
const SMALL_SCREEN_SPECS = /\.(responsive|touch)\.spec\.ts$/;

export default defineConfig<TestOptions>({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  // No retries: every spec is deterministic. The retry spec's injected failure is
  // a fully read response rather than a 5xx, so it runs on a single drained socket
  // with no retry churn to race the recovery fetch. A failing run is a real failure.
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  use: { ignoreHTTPSErrors: true },
  projects: [
    { name: 'smoke', testMatch: /manifest\.smoke\.spec\.ts$/ },
    {
      name: 'debug',
      testMatch: /\.debug\.spec\.ts$/,
      use: { extensionDir: '.output/chrome-mv3-debug', viewport: DESKTOP },
    },
    {
      name: 'production',
      testMatch: /\.production\.spec\.ts$/,
      use: { extensionDir: '.output/chrome-mv3', viewport: DESKTOP },
    },
    {
      name: 'phone',
      testMatch: SMALL_SCREEN_SPECS,
      use: {
        extensionDir: '.output/chrome-mv3-debug',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'tablet',
      testMatch: SMALL_SCREEN_SPECS,
      use: {
        extensionDir: '.output/chrome-mv3-debug',
        viewport: { width: 768, height: 1024 },
        deviceScaleFactor: 2,
        hasTouch: true,
      },
    },
  ],
});
