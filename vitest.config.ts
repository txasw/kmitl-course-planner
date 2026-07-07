import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    // Mirror a production build so IS_DEBUG resolves to a literal in tests.
    __KCP_DEBUG__: 'false',
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**'],
      exclude: ['**/*.{test,spec}.{ts,tsx}'],
      // The brief gates line coverage on the pure domain layer only.
      thresholds: {
        'src/lib/**': { lines: 85 },
      },
    },
  },
});
