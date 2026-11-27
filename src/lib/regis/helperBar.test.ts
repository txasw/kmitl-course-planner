import { describe, expect, it } from 'vitest';
import {
  canPrepareInHelper,
  helperBar,
  pageStale,
  type PrepareHereFacts,
} from './helperBar';
import { INITIAL_HEALTH } from './observerHealth';

describe('pageStale', () => {
  it('reads only pre registration as stale, while degraded or off', () => {
    const degraded = { status: 'degraded', strikes: 1 } as const;
    const off = { status: 'off', reason: 'drift' } as const;
    expect(pageStale('preRegistration', degraded)).toBe(true);
    expect(pageStale('preRegistration', off)).toBe(true);
    expect(pageStale('preRegistration', INITIAL_HEALTH)).toBe(false);
    expect(pageStale('preRegistration', { status: 'healthy' })).toBe(false);
    expect(pageStale('registration', off)).toBe(false);
    expect(pageStale(null, degraded)).toBe(false);
  });
});

describe('helperBar', () => {
  it('names the first bar that applies', () => {
    expect(helperBar({ stale: true, termMismatch: true, hasKit: false })).toBe(
      'stale',
    );
    expect(helperBar({ stale: false, termMismatch: true, hasKit: false })).toBe(
      'termMismatch',
    );
    expect(
      helperBar({ stale: false, termMismatch: false, hasKit: false }),
    ).toBe('kit');
    expect(
      helperBar({ stale: false, termMismatch: false, hasKit: true }),
    ).toBeNull();
  });
});

describe('canPrepareInHelper', () => {
  const offered: PrepareHereFacts = {
    route: 'preRegistration',
    confirmed: true,
    bar: 'kit',
    samePlan: true,
  };

  it('offers the press on pre registration for the helper plan under its kit bar', () => {
    expect(canPrepareInHelper(offered)).toBe(true);
  });

  it('offers nothing once a fresh kit takes the kit bar away', () => {
    expect(canPrepareInHelper({ ...offered, bar: null })).toBe(false);
  });

  it('offers nothing while the stale page or another term takes the bar', () => {
    expect(canPrepareInHelper({ ...offered, bar: 'stale' })).toBe(false);
    expect(canPrepareInHelper({ ...offered, bar: 'termMismatch' })).toBe(false);
  });

  it('offers nothing for a plan whose term was not read from the page', () => {
    expect(canPrepareInHelper({ ...offered, confirmed: false })).toBe(false);
  });

  it('offers nothing for another plan than the one the helper follows', () => {
    expect(canPrepareInHelper({ ...offered, samePlan: false })).toBe(false);
  });

  it('offers nothing on any route but pre registration', () => {
    expect(canPrepareInHelper({ ...offered, route: 'registration' })).toBe(
      false,
    );
    expect(canPrepareInHelper({ ...offered, route: null })).toBe(false);
  });
});
