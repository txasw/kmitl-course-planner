// The host check (ADR-0079): whether the host build a registration page loaded is one
// KCP may treat as tested. An exact tested script name pair is tested at once. Any other
// pair needs a tested vendor script, since the Vue and Vuetify runtime the actuator
// relies on stays exact, and then the worker reads the app script once by its exact
// name, fingerprints its parts, and compares them with the recorded tested builds.
//
// What was read for an app script is kept by its name, in worker memory and in
// storage.local, so each new build costs one request per browser and is never read again
// while kept; a mismatch is kept as well, since the same name serves the same file. A
// request that did not complete is kept with its time and tried again only on a visit
// an hour later, so nothing polls the host. Any failure answers with a verdict that keeps
// fill off. The page's names reach the worker only as these two public file names.

import type { HostBuildVerdict } from '../regis/buildVerdict';
import {
  compareFingerprint,
  fingerprintScript,
  type RecordedBuild,
} from '../regis/fingerprint/fingerprint';
import {
  APP_SCRIPT_NAME,
  VENDOR_SCRIPT_NAME,
  isTestedBuild,
  isTestedVendor,
} from '../regis/hostContract';
import type {
  HostCheckRepository,
  HostCheckResult,
} from '../storage/hostChecks';
import { fetchHostScript } from './hostScript';
import type { GatewayEnv } from './types';

/** How long a check that did not complete waits before a later visit tries again. */
export const HOST_CHECK_RETRY_MS = 60 * 60 * 1000;

export interface HostCheckDeps {
  env: Pick<GatewayEnv, 'fetch' | 'now'>;
  repo: HostCheckRepository;
  /** The recorded tested builds; the debug build adds the replica's. */
  recorded: () => readonly RecordedBuild[];
}

export interface HostPair {
  app: string;
  vendors: string;
}

export interface HostCheck {
  check: (pair: HostPair) => Promise<HostBuildVerdict>;
}

export function createHostCheck(deps: HostCheckDeps): HostCheck {
  const memory = new Map<string, HostCheckResult>();
  const inFlight = new Map<string, Promise<HostCheckResult>>();

  async function stored(app: string): Promise<HostCheckResult | null> {
    try {
      return await deps.repo.load(app);
    } catch {
      return null;
    }
  }

  async function readScript(app: string): Promise<HostCheckResult> {
    const outcome = await fetchHostScript(app, deps.env);
    if (outcome.kind === 'unreadable') return { kind: 'unreadable' };
    if (outcome.kind === 'failed')
      return { kind: 'failed', at: deps.env.now() };
    try {
      const parts = await fingerprintScript(outcome.source);
      return parts === null ? { kind: 'unreadable' } : { kind: 'read', parts };
    } catch {
      // A fault in the reading is KCP's, so it is not kept as the script's verdict.
      return { kind: 'failed', at: deps.env.now() };
    }
  }

  async function resultFor(app: string): Promise<HostCheckResult> {
    const kept = memory.get(app) ?? (await stored(app));
    const fresh =
      kept !== null &&
      (kept.kind !== 'failed' ||
        deps.env.now() - kept.at < HOST_CHECK_RETRY_MS);
    if (kept !== null && fresh) {
      memory.set(app, kept);
      return kept;
    }
    const result = await readScript(app);
    memory.set(app, result);
    await deps.repo.save(app, result).catch(() => undefined);
    return result;
  }

  return {
    check: async ({ app, vendors }) => {
      if (!APP_SCRIPT_NAME.test(app) || !VENDOR_SCRIPT_NAME.test(vendors)) {
        return { status: 'unreadable' };
      }
      if (isTestedBuild([app, vendors])) return { status: 'tested' };
      if (!isTestedVendor(vendors)) return { status: 'untestedVendor' };
      let pending = inFlight.get(app);
      if (pending === undefined) {
        pending = resultFor(app).finally(() => {
          inFlight.delete(app);
        });
        inFlight.set(app, pending);
      }
      const result = await pending;
      if (result.kind !== 'read') return { status: result.kind };
      const verdict = compareFingerprint(result.parts, deps.recorded());
      return verdict.status === 'verified'
        ? { status: 'verified' }
        : { status: 'mismatch', parts: verdict.parts };
    },
  };
}
