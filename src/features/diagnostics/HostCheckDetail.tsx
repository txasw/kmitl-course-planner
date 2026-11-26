// Debug only. What the host check found for this page's build (ADR-0079), under the
// helper's bar for a build KCP was not tested with: which parts of the app script differ
// from the closest tested build, or why there is no fingerprint. Copy is hardcoded
// English because it ships only in debug builds and is never user facing. This module
// ships only in the debug chunk and embeds the canary the production bundle check greps
// for.

import { useStore } from 'zustand';
import type { HostBuildVerdict } from '@/lib/regis/buildVerdict';
import { buildCheckStore } from '@/features/regis/host/buildCheckStore';

/** @canary The marker the CI bundle check greps for (ADR-0014). */
export const DEBUG_CANARY = 'kcp-debug-canary';

export function hostCheckText(verdict: HostBuildVerdict | null): string {
  if (verdict === null) return 'Host check: running';
  switch (verdict.status) {
    case 'mismatch':
      return `Host check: parts differ from the closest tested build: ${verdict.parts.join(', ')}`;
    case 'unreadable':
      return 'Host check: the app script could not be read';
    case 'failed':
      return 'Host check: the app script request did not complete';
    case 'untestedVendor':
      return 'Host check: the vendor script is not a tested one';
    default:
      return `Host check: ${verdict.status}`;
  }
}

export function HostCheckDetail() {
  const check = useStore(buildCheckStore, (state) => state.check);
  if (check === null) {
    return null;
  }
  return (
    <p
      data-testid="kcp-host-check"
      className="mx-1 mb-2 px-2 text-xs break-words text-ink-soft"
    >
      {hostCheckText(check.verdict)}
    </p>
  );
}
