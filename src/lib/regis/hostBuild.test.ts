import { describe, expect, it } from 'vitest';
import { buildKey, fillGate } from './hostBuild';

const TESTED = ['chunk-vendors.7ab4925e.js', 'app.454d9e95.js'];

describe('fillGate', () => {
  it('lets fill run on the tested build', () => {
    expect(fillGate(TESTED, [])).toBe('ok');
  });

  it('lets fill run on the 2026-11-25 redeploy', () => {
    expect(fillGate(['chunk-vendors.7ab4925e.js', 'app.020e81ed.js'], [])).toBe(
      'ok',
    );
  });

  it('turns fill off on any other build', () => {
    expect(fillGate(['app.00000000.js', TESTED[0] ?? ''], [])).toBe(
      'untestedBuild',
    );
    expect(fillGate(['app.454d9e95.js'], [])).toBe('untestedBuild');
  });

  it('keeps fill off on a build an actuator refusal latched', () => {
    const key = buildKey(TESTED);
    expect(key).toBe('app.454d9e95.js chunk-vendors.7ab4925e.js');
    expect(fillGate(TESTED, [key ?? ''])).toBe('latched');
    expect(fillGate(TESTED, ['app.11111111.js'])).toBe('ok');
  });

  it('keys only host script names', () => {
    expect(buildKey(['main.js'])).toBeNull();
  });
});
