// Worker memory state for the diagnostics drawer: the simulation settings, the
// last fifty request log entries, and the latest data quality report. The
// recorder enriches each log entry with the issue count from the latest audit,
// which the gateway leaves at zero. Debug only module; dropped from production and
// its canary never ships. State is per worker lifetime because the MV3 worker is
// ephemeral.

import type { LatestRaw, RequestLogEntry, SimSettings } from '../types';
import type { DataQualityReport } from '../../contract/report';
import type { Recorder } from '../interceptors';

export const DEBUG_CANARY = 'kcp-debug-canary';

const RING_CAP = 50;

export interface DebugState {
  recorder: Recorder;
  getSettings(): SimSettings;
  setSettings(patch: Partial<SimSettings>): void;
  getRequestLog(): RequestLogEntry[];
  getReport(): DataQualityReport | null;
  setReport(report: DataQualityReport): void;
  getLatestRaw(): LatestRaw | null;
  setLatestRaw(value: LatestRaw): void;
}

export function createDebugState(): DebugState {
  let settings: SimSettings = {
    fixtureId: null,
    faultId: null,
    mutationId: null,
  };
  const requestLog: RequestLogEntry[] = [];
  let latestReport: DataQualityReport | null = null;
  let latestRaw: LatestRaw | null = null;

  const recorder: Recorder = {
    record(entry) {
      requestLog.push({
        ...entry,
        issueCount: latestReport?.totals.issues ?? 0,
      });
      if (requestLog.length > RING_CAP) {
        requestLog.shift();
      }
    },
  };

  return {
    recorder,
    getSettings: () => settings,
    setSettings(patch) {
      settings = { ...settings, ...patch };
    },
    getRequestLog: () => [...requestLog],
    getReport: () => latestReport,
    setReport(report) {
      latestReport = report;
    },
    getLatestRaw: () => latestRaw,
    setLatestRaw(value) {
      latestRaw = value;
    },
  };
}
