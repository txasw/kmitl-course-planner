// The read only observer's health (ADR-0077), as one pure transition. The observer runs
// only on a host build KCP was tested against, by name or by the host check (ADR-0079),
// and never in a staff surrogate session; either finding turns it off for the rest of the
// document. While the host check runs, the observer waits. A page that shows none of
// the anchors yet is waiting, not broken. A page whose anchors are present but do not
// read as the contract says is degraded, and the observation is dropped whole; three
// degraded readings in a row turn the observer off. While it is degraded or off each
// subject keeps the last status the page showed in this visit, marked stale, and a page
// never read in this visit shows every subject as still to add.

import type { BuildTrust } from './hostBuild';

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
  build: BuildTrust;
}

/** The strikes after which a drifting page turns the observer off. */
export const DRIFT_STRIKES = 3;

export const INITIAL_HEALTH: ObserverHealth = { status: 'waiting', strikes: 0 };

function strikesOf(health: ObserverHealth): number {
  return health.status === 'waiting' || health.status === 'degraded'
    ? health.strikes
    : 0;
}

/**
 * The health a student's Check again starts from. Drift may have passed (the page was
 * mid render, or a dialog stood in the way), so a drift off reads again from the start,
 * still bounded by the strikes; a surrogate session or an untested build cannot change
 * within the document, so it stays off and the helper offers no Check again for it.
 */
export function recheckHealth(current: ObserverHealth): ObserverHealth {
  return current.status === 'off' && current.reason === 'drift'
    ? INITIAL_HEALTH
    : current;
}

/** Whether a Check again can change what the observer reads. */
export function canRecheck(health: ObserverHealth): boolean {
  return health.status !== 'off' || health.reason === 'drift';
}

export function nextHealth(
  current: ObserverHealth,
  gate: Gate,
  reading: Reading,
): ObserverHealth {
  if (current.status === 'off') return current;
  if (gate.surrogate) return { status: 'off', reason: 'surrogate' };
  if (gate.build === 'untested')
    return { status: 'off', reason: 'untestedBuild' };
  if (gate.build === 'checking') {
    return { status: 'waiting', strikes: strikesOf(current) };
  }
  if (reading === 'ok') return { status: 'healthy' };
  if (reading === 'absent') {
    return { status: 'waiting', strikes: strikesOf(current) };
  }
  const strikes = strikesOf(current) + 1;
  return strikes >= DRIFT_STRIKES
    ? { status: 'off', reason: 'drift' }
    : { status: 'degraded', strikes };
}
