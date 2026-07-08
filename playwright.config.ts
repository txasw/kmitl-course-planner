import { defineConfig } from '@playwright/test';
import type { TestOptions } from './tests/e2e/support/fixtures';

// The smoke project reads the built production manifest off disk. The debug and
// production projects load the matching built extension: debug for the open
// shadow root the browser driven specs need, production for the isolation
// assertions. The extension directory is resolved against the working directory
// by the fixtures, so relative paths are enough here. Extension contexts are
// heavy, so runs stay serial.
export default defineConfig<TestOptions>({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  // A transient connection level flake in the extension network stack should not
  // fail the run; a real failure fails every attempt.
  retries: process.env.CI ? 2 : 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  // A wide viewport keeps the catalog in its dominant column rather than the
  // mobile drawer, so the visible copy is the first match.
  use: { ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } },
  projects: [
    { name: 'smoke', testMatch: /manifest\.smoke\.spec\.ts$/ },
    {
      name: 'debug',
      testMatch: /\.debug\.spec\.ts$/,
      use: { extensionDir: '.output/chrome-mv3-debug' },
    },
    {
      name: 'production',
      testMatch: /\.production\.spec\.ts$/,
      use: { extensionDir: '.output/chrome-mv3' },
    },
  ],
});
