import { describe, expect, it } from 'vitest';
import type { HostBuildVerdict } from './buildVerdict';
import {
  buildKey,
  buildTrust,
  checkablePair,
  fillGate,
  type BuildCheck,
} from './hostBuild';

const VENDORS = 'chunk-vendors.7ab4925e.js';
const TESTED = [VENDORS, 'app.454d9e95.js'];
const NEW = [VENDORS, 'app.c0ffee01.js'];
const NEW_KEY = buildKey(NEW) ?? '';

function answered(verdict: HostBuildVerdict, key = NEW_KEY): BuildCheck {
  return { key, verdict };
}

describe('fillGate', () => {
  it('lets fill run on each tested build by name, with no check', () => {
    for (const app of [
      'app.454d9e95.js',
      'app.020e81ed.js',
      'app.a1e43722.js',
      'app.ba450963.js',
      'app.2ef67281.js',
    ]) {
      expect(fillGate([VENDORS, app], [], null), app).toBe('ok');
    }
  });

  it('lets fill run on a new build the host check verified', () => {
    expect(fillGate(NEW, [], answered({ status: 'verified' }))).toBe('ok');
  });

  it('keeps fill off on a new build as checking until the check answers', () => {
    expect(fillGate(NEW, [], null)).toBe('checking');
    expect(fillGate(NEW, [], { key: NEW_KEY, verdict: null })).toBe('checking');
  });

  const OFF: HostBuildVerdict[] = [
    { status: 'mismatch', parts: ['labels'] },
    { status: 'unreadable' },
    { status: 'failed' },
    { status: 'untestedVendor' },
  ];

  it.each(OFF)(
    'keeps fill off on a new build the check found %o',
    (verdict) => {
      expect(fillGate(NEW, [], answered(verdict))).toBe('untestedBuild');
    },
  );

  it('reads a verdict only for the build it was given for', () => {
    const other = answered({ status: 'verified' }, 'app.00000000.js x');
    expect(fillGate(NEW, [], other)).toBe('checking');
  });

  it('turns fill off on a build missing a script or with an untested vendor', () => {
    expect(fillGate(['app.454d9e95.js'], [], null)).toBe('untestedBuild');
    expect(
      fillGate(
        ['app.c0ffee01.js', 'chunk-vendors.00000000.js'],
        [],
        answered({ status: 'verified' }),
      ),
    ).toBe('untestedBuild');
  });

  it('keeps fill off on a build an actuator refusal latched', () => {
    const key = buildKey(TESTED);
    expect(key).toBe('app.454d9e95.js chunk-vendors.7ab4925e.js');
    expect(fillGate(TESTED, [key ?? ''], null)).toBe('latched');
    expect(fillGate(TESTED, ['app.11111111.js'], null)).toBe('ok');
    expect(fillGate(NEW, [NEW_KEY], answered({ status: 'verified' }))).toBe(
      'latched',
    );
  });

  it('keys only host script names', () => {
    expect(buildKey(['main.js'])).toBeNull();
  });
});

describe('buildTrust', () => {
  it('is checking only for a new app beside a tested vendor script', () => {
    expect(buildTrust(NEW, null)).toBe('checking');
    expect(buildTrust(TESTED, null)).toBe('tested');
    expect(
      buildTrust(['app.c0ffee01.js', 'chunk-vendors.00000000.js'], null),
    ).toBe('untested');
    expect(buildTrust([...NEW, 'app.c0ffee02.js'], null)).toBe('untested');
  });

  it('names the pair the worker checks, and none for a tested build', () => {
    expect(checkablePair(NEW)).toEqual({
      app: 'app.c0ffee01.js',
      vendors: VENDORS,
    });
    expect(checkablePair(TESTED)).toBeNull();
  });
});
