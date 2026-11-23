import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// KCP never registers on the student's behalf, so no source file and no built bundle
// names the host's registration writes or the methods and dialogs that lead to them.
// KCP code never needs these names, so any match is a defect, in the style of the debug
// canary check. The built bundles are scanned when a build is present.

const WRITE_NAMES = [
  'regis-pre-regis',
  'regis-add',
  'regis-change',
  'regis-withdraw',
  'regis-maintain-and-drop',
  'cancel-queue',
  'function=regis',
  'regisPreRegis',
  'submit_2',
  'confirm_pre_regis_dialog',
  'confirm_regis_dialog',
];

const SCANNED = /\.(ts|tsx|js|mjs|json|html)$/;

function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return filesUnder(full);
    return SCANNED.test(name) ? [full] : [];
  });
}

function matchesIn(dir: string): string[] {
  return filesUnder(resolve(process.cwd(), dir)).flatMap((file) => {
    const text = readFileSync(file, 'utf8');
    return WRITE_NAMES.filter((name) => text.includes(name)).map(
      (name) => `${file}: ${name}`,
    );
  });
}

describe('the registration write name scan', () => {
  it.each(['src', 'tests/fixtures', 'tests/e2e/host'])(
    'finds no write name in %s',
    (dir) => {
      expect(matchesIn(dir)).toEqual([]);
    },
  );

  it.each(['.output/chrome-mv3', '.output/firefox-mv3'])(
    'finds no write name in the %s bundle when built',
    (dir) => {
      expect(matchesIn(dir)).toEqual([]);
    },
  );
});
