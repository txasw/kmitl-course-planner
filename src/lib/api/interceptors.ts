// The interceptor registry the gateway consults on every request. It is
// production safe: it holds only null slots and carries no debug canary. The
// gateway calls the getters unconditionally, so in production the slots stay null
// and the calls are cheap no-ops. Debug builds populate the slots through the
// dynamically imported debug register module, which the production build drops.
// Tests register fakes directly.

import type { FaultOutcome, RequestContext, RequestLogEntry } from './types';

/** What a simulation interceptor forces in place of a normal fetch, if anything. */
export type SimDirective =
  | { kind: 'fixture'; response: unknown }
  | { kind: 'fault'; fault: FaultOutcome }
  | { kind: 'mutate'; mutate: (raw: unknown) => unknown };

export interface SimulationInterceptor {
  intercept(context: RequestContext): SimDirective | null;
}

export interface AuditInterceptor {
  observe(context: RequestContext, raw: unknown): void;
}

export interface Recorder {
  record(entry: RequestLogEntry): void;
}

let simulation: SimulationInterceptor | null = null;
let audit: AuditInterceptor | null = null;
let recorder: Recorder | null = null;

export function setSimulation(value: SimulationInterceptor | null): void {
  simulation = value;
}

export function getSimulation(): SimulationInterceptor | null {
  return simulation;
}

export function setAudit(value: AuditInterceptor | null): void {
  audit = value;
}

export function getAudit(): AuditInterceptor | null {
  return audit;
}

export function setRecorder(value: Recorder | null): void {
  recorder = value;
}

export function getRecorder(): Recorder | null {
  return recorder;
}

/** Clear every registered interceptor. Used at test teardown. */
export function resetInterceptors(): void {
  simulation = null;
  audit = null;
  recorder = null;
}
