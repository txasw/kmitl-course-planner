// Production safe types shared across the gateway and the messaging protocol.
// Nothing here carries the debug canary or imports a debug module, so the
// protocol can reference these shapes without dragging diagnostic code into the
// production bundle.

/**
 * The ambient dependencies the gateway needs, injected so tests can supply
 * deterministic fetch, clock, jitter, and delay implementations.
 */
export interface GatewayEnv {
  fetch: typeof fetch;
  now: () => number;
  random: () => number;
  sleep: (ms: number) => Promise<void>;
}

/**
 * One entry in the request log ring buffer surfaced by the debug drawer. It
 * carries only clone safe primitives so it can cross the messaging boundary.
 */
export interface RequestLogEntry {
  endpoint: string;
  params: Record<string, string>;
  durationMs: number;
  cacheHit: boolean;
  retryCount: number;
  /** HTTP status of the final attempt, or null when no response was received. */
  status: number | null;
  issueCount: number;
}

/** The simulation controls the debug drawer can set on the worker. */
export interface SimSettings {
  fixtureId: string | null;
  faultId: string | null;
  mutationId: string | null;
}

/** The outcome a simulated fault forces in place of a real network attempt. */
export type FaultOutcome =
  | { kind: 'network' }
  | { kind: 'timeout' }
  | { kind: 'http'; status: number }
  | { kind: 'latency'; ms: number };
