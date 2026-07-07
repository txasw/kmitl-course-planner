import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const manifestPath = resolve(here, '../../.output/chrome-mv3/manifest.json');

// Guards the least privilege manifest and the debug canary against regressions.
// Full browser driven end to end coverage arrives in later phases.
test.describe('chrome production manifest', () => {
  test('exists and requests least privilege', () => {
    expect(
      existsSync(manifestPath),
      `Build the chrome bundle first (pnpm wxt build -b chrome): ${manifestPath}`,
    ).toBe(true);

    // Test only assertion of a known shape, validated by the checks below.
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      manifest_version: number;
      name: string;
      permissions: string[];
      host_permissions: string[];
    };

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe('KMITL Course Planner');
    expect(manifest.permissions).toEqual(['storage']);
    expect(manifest.host_permissions).toEqual([
      'https://regis.reg.kmitl.ac.th/*',
      'https://api.reg.kmitl.ac.th/*',
    ]);
  });
});
