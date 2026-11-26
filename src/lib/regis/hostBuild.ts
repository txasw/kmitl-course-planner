// Whether the observer and fill may run on the host build this page loaded (ADR-0078,
// ADR-0079). A build is tested when its script names are an exact tested pair, or when
// the worker's host check found every part of its app script equal to a tested build's
// beside a tested vendor script. Until the check answers, the build is checking: the
// observer waits and fill stays off. Any other verdict leaves it untested, since
// structure and labels alone cannot see a host change in what a button means. An
// actuator refusal latches fill off for the build it happened on, kept by the build's
// script names, which are public, until an extension update ships a newer allowlist.

import { isTrusted, type HostBuildVerdict } from './buildVerdict';
import {
  SCRIPT_NAME,
  hostPair,
  isTestedBuild,
  isTestedVendor,
} from './hostContract';

export type FillGate = 'ok' | 'untestedBuild' | 'latched';

export type BuildTrust = 'tested' | 'checking' | 'untested';

/** The host check's answer for one build, by its key, or null while it runs. */
export interface BuildCheck {
  key: string;
  verdict: HostBuildVerdict | null;
}

/** The latch key of the page's build: its host script names, sorted, or null. */
export function buildKey(names: readonly string[]): string | null {
  const own = [...new Set(names.filter((name) => SCRIPT_NAME.test(name)))];
  return own.length === 0 ? null : own.sort().join(' ');
}

/** Whether the page's build needs the worker's host check, and for which pair. */
export function checkablePair(
  names: readonly string[],
): { app: string; vendors: string } | null {
  if (isTestedBuild(names)) return null;
  const pair = hostPair(names);
  return pair !== null && isTestedVendor(pair.vendors) ? pair : null;
}

export function buildTrust(
  names: readonly string[],
  check: BuildCheck | null,
): BuildTrust {
  if (isTestedBuild(names)) return 'tested';
  if (checkablePair(names) === null) return 'untested';
  if (check?.key !== buildKey(names) || check.verdict === null) {
    return 'checking';
  }
  return isTrusted(check.verdict) ? 'tested' : 'untested';
}

export function fillGate(
  names: readonly string[],
  latched: readonly string[],
  check: BuildCheck | null,
): FillGate {
  if (buildTrust(names, check) !== 'tested') return 'untestedBuild';
  const key = buildKey(names);
  return key !== null && latched.includes(key) ? 'latched' : 'ok';
}
