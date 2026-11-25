import { describe, expect, it } from 'vitest';
import {
  DRIFT_STRIKES,
  INITIAL_HEALTH,
  canRecheck,
  recheckHealth,
  nextHealth,
  type Gate,
  type ObserverHealth,
  type Reading,
} from './observerHealth';

const OPEN: Gate = { surrogate: false, testedBuild: true };

function run(readings: readonly Reading[], gate: Gate = OPEN): ObserverHealth {
  return readings.reduce(
    (health, reading) => nextHealth(health, gate, reading),
    INITIAL_HEALTH,
  );
}

describe('nextHealth', () => {
  it('is healthy on a reading that matches the contract', () => {
    expect(run(['ok'])).toEqual({ status: 'healthy' });
  });

  it('waits while the page shows no anchor yet', () => {
    expect(run(['absent'])).toEqual({ status: 'waiting', strikes: 0 });
  });

  it('turns off for an untested host build whatever the page shows', () => {
    const gate = { surrogate: false, testedBuild: false };
    expect(run(['ok'], gate)).toEqual({
      status: 'off',
      reason: 'untestedBuild',
    });
  });

  it('turns off in a staff surrogate session', () => {
    const gate = { surrogate: true, testedBuild: true };
    expect(run(['ok'], gate)).toEqual({ status: 'off', reason: 'surrogate' });
  });

  it('stays off for the document once off', () => {
    const off = run(['ok'], { surrogate: true, testedBuild: true });
    expect(nextHealth(off, OPEN, 'ok')).toBe(off);
  });

  it('degrades on drift and turns off after the strikes in a row', () => {
    const drifts: Reading[] = Array.from(
      { length: DRIFT_STRIKES - 1 },
      () => 'drift',
    );
    expect(run(drifts)).toEqual({
      status: 'degraded',
      strikes: DRIFT_STRIKES - 1,
    });
    expect(run([...drifts, 'drift'])).toEqual({
      status: 'off',
      reason: 'drift',
    });
  });

  it('forgives drift after a healthy reading but not after a waiting one', () => {
    expect(run(['drift', 'drift', 'ok', 'drift', 'drift'])).toEqual({
      status: 'degraded',
      strikes: 2,
    });
    expect(run(['drift', 'drift', 'absent', 'drift'])).toEqual({
      status: 'off',
      reason: 'drift',
    });
  });
});

describe('recheckHealth', () => {
  it('reads a drift off page again from the start', () => {
    expect(recheckHealth({ status: 'off', reason: 'drift' })).toEqual(
      INITIAL_HEALTH,
    );
    expect(canRecheck({ status: 'off', reason: 'drift' })).toBe(true);
  });

  it('keeps an untested build and a surrogate session off, with no Check again', () => {
    for (const reason of ['untestedBuild', 'surrogate'] as const) {
      expect(recheckHealth({ status: 'off', reason })).toEqual({
        status: 'off',
        reason,
      });
      expect(canRecheck({ status: 'off', reason })).toBe(false);
    }
  });

  it('leaves a degraded page to the read the check starts', () => {
    const degraded = { status: 'degraded', strikes: 2 } as const;
    expect(recheckHealth(degraded)).toBe(degraded);
    expect(canRecheck(degraded)).toBe(true);
  });
});
