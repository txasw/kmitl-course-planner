import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

const PRODUCT_NAME = 'Course Planner for KMITL';

// See https://wxt.dev/api/config. The manifest is a function so the debug build
// flavor can carry a distinct name, and so network egress stays limited to the
// two KMITL origins the product actually calls. Tailwind v4 emits its theme
// variables under ":root, :host", so tokens resolve inside the closed shadow
// root without any extra transform.
export default defineConfig({
  srcDir: 'src',
  // Manifest V3 for every target. WXT emits the Firefox appropriate background
  // shape (scripts rather than a service worker) from the single background
  // entrypoint.
  manifestVersion: 3,
  modules: ['@wxt-dev/module-react'],
  manifest: ({ mode }) => ({
    name: mode === 'production' ? PRODUCT_NAME : `${PRODUCT_NAME} (Debug)`,
    description:
      'Weekly timetable planner for KMITL pre registration course selection.',
    permissions: ['storage'],
    host_permissions: [
      'https://regis.reg.kmitl.ac.th/*',
      'https://api.reg.kmitl.ac.th/*',
    ],
    browser_specific_settings: {
      gecko: {
        id: 'kmitl-course-planner@txasw.github.io',
      },
    },
    icons: {
      16: '/icon/16.png',
      32: '/icon/32.png',
      48: '/icon/48.png',
      96: '/icon/96.png',
      128: '/icon/128.png',
    },
  }),
  vite: (env) => ({
    plugins: [tailwindcss()],
    define: {
      // Baked in literal so debug only modules dead code eliminate from
      // production output. Runtime code reads this through src/lib/env.ts.
      __KCP_DEBUG__: JSON.stringify(env.mode !== 'production'),
    },
  }),
});
