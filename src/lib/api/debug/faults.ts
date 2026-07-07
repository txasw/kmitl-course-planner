// Fault injection presets for the diagnostics simulator. Each preset names a
// fault outcome the simulation interceptor forces in place of a real network
// attempt, so a tester can reproduce network, timeout, and HTTP status failures
// against the live site. This is a debug only module: it is reached solely through
// the dynamically imported register module, so it is dropped from production and
// its canary never ships. Mirrors the mutation preset shape in lib/contract.

import type { FaultOutcome } from '../types';

export const DEBUG_CANARY = 'kcp-debug-canary';

export interface FaultPreset {
  readonly id: string;
  readonly label: string;
  readonly outcome: FaultOutcome;
}

export const FAULT_PRESETS: readonly FaultPreset[] = [
  { id: 'network_error', label: 'Network error', outcome: { kind: 'network' } },
  { id: 'timeout', label: 'Timeout', outcome: { kind: 'timeout' } },
  { id: 'http_400', label: 'HTTP 400', outcome: { kind: 'http', status: 400 } },
  { id: 'http_403', label: 'HTTP 403', outcome: { kind: 'http', status: 403 } },
  { id: 'http_500', label: 'HTTP 500', outcome: { kind: 'http', status: 500 } },
  { id: 'http_503', label: 'HTTP 503', outcome: { kind: 'http', status: 503 } },
  {
    id: 'added_latency',
    label: 'Added latency 5s',
    outcome: { kind: 'latency', ms: 5000 },
  },
];

export function findFault(id: string): FaultPreset | undefined {
  return FAULT_PRESETS.find((preset) => preset.id === id);
}
