import { describe, expect, it } from 'vitest';
import { buildManifest, type ManifestEnv } from '../../manifest.config';

const BROWSERS = ['chrome', 'firefox'] as const;
const MODES = ['production', 'debug'] as const;

const COMBINATIONS: ManifestEnv[] = BROWSERS.flatMap((browser) =>
  MODES.map((mode) => ({ browser, mode })),
);

// Keys the least privilege rule forbids. A future feature that needs one of
// them records a decision first, and this list changes with it.
const FORBIDDEN_PERMISSIONS = ['tabs', 'activeTab', 'scripting', '<all_urls>'];

describe.each(COMBINATIONS)('manifest for $browser in $mode', (env) => {
  const manifest = buildManifest(env);

  it('requests storage as its only permission', () => {
    expect(manifest.permissions).toEqual(['storage']);
    for (const permission of FORBIDDEN_PERMISSIONS) {
      expect(manifest.permissions).not.toContain(permission);
    }
    expect(manifest).not.toHaveProperty('optional_permissions');
    expect(manifest).not.toHaveProperty('optional_host_permissions');
  });

  it('reaches only the two KMITL origins', () => {
    expect(manifest.host_permissions).toEqual([
      'https://regis.reg.kmitl.ac.th/*',
      'https://api.reg.kmitl.ac.th/*',
    ]);
  });

  it('keeps the gecko id and declares no data collection', () => {
    expect(manifest.browser_specific_settings).toEqual({
      gecko: {
        id: 'kmitl-course-planner@txasw.github.io',
        data_collection_permissions: { required: ['none'] },
      },
    });
  });

  it('names the build flavor', () => {
    expect(manifest.name).toBe(
      env.mode === 'production'
        ? 'Course Planner for KMITL'
        : 'Course Planner for KMITL (Debug)',
    );
  });
});

describe.each(COMBINATIONS)('toolbar action for $browser in $mode', (env) => {
  const manifest = buildManifest(env);

  it('opens the panel from the icon with no popup', () => {
    expect(manifest.action).toBeDefined();
    expect(manifest.action).not.toHaveProperty('default_popup');
    expect(manifest.action?.default_title).toBe(manifest.name);
    expect(manifest.action?.default_icon).toEqual({
      16: '/icon/16.png',
      32: '/icon/32.png',
    });
  });

  it('pins the icon to the toolbar on Firefox only', () => {
    if (env.browser === 'firefox') {
      expect(manifest.action?.default_area).toBe('navbar');
    } else {
      expect(manifest.action).not.toHaveProperty('default_area');
    }
  });

  it('suggests Alt+Shift+P for the action command', () => {
    expect(manifest.commands).toEqual({
      _execute_action: { suggested_key: { default: 'Alt+Shift+P' } },
    });
  });
});

describe('toolbar action title in debug', () => {
  it('carries the debug suffix', () => {
    expect(
      buildManifest({ browser: 'chrome', mode: 'debug' }).action?.default_title,
    ).toBe('Course Planner for KMITL (Debug)');
  });
});

describe('manifest name in development', () => {
  it('carries the debug suffix outside a production build', () => {
    expect(buildManifest({ browser: 'chrome', mode: 'development' }).name).toBe(
      'Course Planner for KMITL (Debug)',
    );
  });
});
