import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

interface BuiltManifest {
  manifest_version: number;
  name: string;
  permissions: string[];
  host_permissions: string[];
  action?: Record<string, unknown>;
  commands?: Record<string, unknown>;
  browser_specific_settings?: Record<string, unknown>;
}

/** Reads one production build's manifest, failing with the build command when it is absent. */
function readBuiltManifest(browser: 'chrome' | 'firefox'): BuiltManifest {
  const manifestPath = resolve(
    here,
    `../../.output/${browser}-mv3/manifest.json`,
  );
  expect(
    existsSync(manifestPath),
    `Build the ${browser} bundle first (pnpm wxt build -b ${browser}): ${manifestPath}`,
  ).toBe(true);
  // Test only assertion of a known shape, validated by the checks that follow.
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as BuiltManifest;
}

function expectLeastPrivilege(manifest: BuiltManifest): void {
  expect(manifest.manifest_version).toBe(3);
  expect(manifest.name).toBe('KCP: Course Planner for KMITL');
  expect(manifest.permissions).toEqual(['storage']);
  expect(manifest.host_permissions).toEqual([
    'https://regis.reg.kmitl.ac.th/*',
    'https://api.reg.kmitl.ac.th/*',
  ]);
}

// Guards the least privilege manifest of both production builds against
// regressions. The browser driven specs cover behavior.
test.describe('chrome production manifest', () => {
  test('exists and requests least privilege', () => {
    const manifest = readBuiltManifest('chrome');
    expectLeastPrivilege(manifest);
    // The toolbar icon and its shortcut open the panel, with no popup and no
    // Firefox only key in the Chrome build.
    expect(manifest.action).toEqual({
      default_title: 'KCP: Course Planner for KMITL',
      default_icon: { '16': '/icon/16.png', '32': '/icon/32.png' },
    });
    expect(manifest.commands).toEqual({
      _execute_action: { suggested_key: { default: 'Alt+Shift+P' } },
    });
  });
});

test.describe('firefox production manifest', () => {
  test('requests least privilege and declares Firefox for Android', () => {
    const manifest = readBuiltManifest('firefox');
    expectLeastPrivilege(manifest);
    // The Android declaration lists the add-on for Firefox for Android (ADR-0070).
    expect(manifest.browser_specific_settings).toEqual({
      gecko: {
        id: 'kmitl-course-planner@txasw.github.io',
        data_collection_permissions: { required: ['none'] },
      },
      gecko_android: { strict_min_version: '142.0' },
    });
  });
});
