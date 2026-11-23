// Whether fill may run on the host build this page loaded (ADR-0078). Fill runs only on a
// host build KCP was tested against, because structure and labels alone cannot see a host
// change in what a button means. An actuator refusal latches fill off for the build it
// happened on, kept by the build's script names, which are public, until an extension
// update ships a newer allowlist. The observer keeps its own rule (ADR-0077).

import { SCRIPT_NAME, isTestedBuild } from './hostContract';

export type FillGate = 'ok' | 'untestedBuild' | 'latched';

/** The latch key of the page's build: its host script names, sorted, or null. */
export function buildKey(names: readonly string[]): string | null {
  const own = [...new Set(names.filter((name) => SCRIPT_NAME.test(name)))];
  return own.length === 0 ? null : own.sort().join(' ');
}

export function fillGate(
  names: readonly string[],
  latched: readonly string[],
): FillGate {
  if (!isTestedBuild(names)) return 'untestedBuild';
  const key = buildKey(names);
  return key !== null && latched.includes(key) ? 'latched' : 'ok';
}
