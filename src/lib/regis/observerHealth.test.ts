import { describe, expect, it } from 'vitest';
import {
  DRIFT_STRIKES,
  INITIAL_HEALTH,
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
