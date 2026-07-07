import { defineConfig } from '@playwright/test';

// Phase 0 ships a smoke skeleton only. Full extension end to end coverage that
// loads the built extension and drives the launcher lands in later phases.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
});
