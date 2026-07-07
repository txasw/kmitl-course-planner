import { describe, expect, it } from 'vitest';
import { createDebugState } from './state';
import { emptyByKind, type DataQualityReport } from '../../contract/report';
import type { RequestLogEntry } from '../types';

function entry(endpoint: string): RequestLogEntry {
  return {
    endpoint,
    params: {},
    durationMs: 1,
    cacheHit: false,
    retryCount: 0,
    status: 200,
    issueCount: 0,
  };
}

function reportWith(issues: number): DataQualityReport {
  return {
    reportVersion: 1,
    extensionVersion: 'x',
    generatedAt: 't',
    request: { endpoint: 'e', params: {} },
    totals: { rows: 0, deduped: 0, issues, byKind: emptyByKind() },
    aggregates: [],
    issues: [],
  };
}

describe('createDebugState', () => {
  it('caps the request log at fifty entries, dropping the oldest', () => {
    const state = createDebugState();
    for (let i = 0; i < 55; i += 1) {
      state.recorder.record(entry(`call-${String(i)}`));
    }
    const log = state.getRequestLog();
    expect(log).toHaveLength(50);
    expect(log[0]?.endpoint).toBe('call-5');
    expect(log[49]?.endpoint).toBe('call-54');
  });

  it('enriches a log entry with the latest report issue count', () => {
    const state = createDebugState();
    state.setReport(reportWith(3));
    state.recorder.record(entry('call'));
    expect(state.getRequestLog()[0]?.issueCount).toBe(3);
  });

  it('merges settings patches and returns the latest report', () => {
    const state = createDebugState();
    state.setSettings({ faultId: 'timeout' });
    state.setSettings({ fixtureId: 'f' });
    expect(state.getSettings()).toEqual({
      fixtureId: 'f',
      faultId: 'timeout',
      mutationId: null,
    });
    const report = reportWith(1);
    state.setReport(report);
    expect(state.getReport()).toBe(report);
  });
});
