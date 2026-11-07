import { defineConfig } from '@playwright/test';
import type { TestOptions } from '../../tests/e2e/support/fixtures';

// The landing page screenshots are captured from the real extension against the e2e
// host replica and its fixture data. This config is separate from the e2e config and
// is run only by pnpm site:shots, so CI never captures. It loads the debug build,
// because only its open shadow root lets locators reach the panel; the capture hides
// the debug only diagnostics control before every shot. Device scale 2 gives the
// masters enough pixels for the 2x image sources.
export default defineConfig<TestOptions>({
  testDir: '.',
  testMatch: /capture-landing-shots\.ts$/,
  outputDir: '../../test-results/landing',
  fullyParallel: false,
  workers: 1,
  timeout: 240_000,
  retries: 0,
  reporter: 'list',
  use: {
    ignoreHTTPSErrors: true,
    actionTimeout: 20_000,
    extensionDir: '.output/chrome-mv3-debug',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  },
});
