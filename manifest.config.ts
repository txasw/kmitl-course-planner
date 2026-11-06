import type { ConfigEnv, UserManifest } from 'wxt';
import { HOST_MATCH_PATTERNS } from './src/lib/shell/hostTab';

const PRODUCT_NAME = 'Course Planner for KMITL';

/** The parts of the WXT config environment the manifest depends on. */
export type ManifestEnv = Pick<ConfigEnv, 'mode' | 'browser'>;

/**
 * The manifest for one browser and build mode. It is a function so the debug
 * build flavor carries a distinct name, and it lives in its own module so every
 * browser and mode combination is unit tested against the least privilege rule:
 * storage is the only permission, and network egress stays limited to the two
 * KMITL origins the product calls.
 */
export function buildManifest({ mode }: ManifestEnv): UserManifest {
  return {
    name: mode === 'production' ? PRODUCT_NAME : `${PRODUCT_NAME} (Debug)`,
    description:
      'Weekly timetable planner for KMITL pre registration course selection.',
    permissions: ['storage'],
    host_permissions: [...HOST_MATCH_PATTERNS],
    browser_specific_settings: {
      gecko: {
        id: 'kmitl-course-planner@txasw.github.io',
        // Firefox data collection consent. The extension collects no user data,
        // so declare none. This also clears the addons-linter warning that the
        // property is missing.
        data_collection_permissions: {
          required: ['none'],
        },
      },
    },
    icons: {
      16: '/icon/16.png',
      32: '/icon/32.png',
      48: '/icon/48.png',
      96: '/icon/96.png',
      128: '/icon/128.png',
    },
  };
}
