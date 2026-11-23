// The read only observer's health (ADR-0077), as one pure transition. The observer runs
// only on a host build KCP was tested against and never in a staff surrogate session;
// either finding turns it off for the rest of the document. A page that shows none of
// the anchors yet is waiting, not broken. A page whose anchors are present but do not
// read as the contract says is degraded, and the observation is dropped whole; three
// degraded readings in a row turn the observer off. While it is not healthy the
// checklist shows the student's own marks only.

export type OffReason = 'surrogate' | 'untestedBuild' | 'drift';

export type ObserverHealth =
  | { status: 'waiting'; strikes: number }
  | { status: 'healthy' }
  | { status: 'degraded'; strikes: number }
  | { status: 'off'; reason: OffReason };

/** What one reading of the page found. */
export type Reading = 'ok' | 'absent' | 'drift';

export interface Gate {
  surrogate: boolean;
  testedBuild: boolean;
}

/** The strikes after which a drifting page turns the observer off. */
export const DRIFT_STRIKES = 3;

export const INITIAL_HEALTH: ObserverHealth = { status: 'waiting', strikes: 0 };

function strikesOf(health: ObserverHealth): number {
  return health.status === 'waiting' || health.status === 'degraded'
    ? health.strikes
    : 0;
}

export function nextHealth(
  current: ObserverHealth,
  gate: Gate,
  reading: Reading,
): ObserverHealth {
  if (current.status === 'off') return current;
  if (gate.surrogate) return { status: 'off', reason: 'surrogate' };
  if (!gate.testedBuild) return { status: 'off', reason: 'untestedBuild' };
  if (reading === 'ok') return { status: 'healthy' };
  if (reading === 'absent') {
    return { status: 'waiting', strikes: strikesOf(current) };
  }
  const strikes = strikesOf(current) + 1;
  return strikes >= DRIFT_STRIKES
    ? { status: 'off', reason: 'drift' }
    : { status: 'degraded', strikes };
}
