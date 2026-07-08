// Debug only. Fetches the request log, the data quality report, and the latest
// raw payload from the worker, refreshing on mount, whenever a query completes,
// and on demand. It also writes the launcher badge count from the report, so a
// contract break is visible without opening the drawer. This module ships only in
// the debug chunk and embeds the canary the production bundle check greps for.

import { useCallback, useEffect, useState } from 'react';
import type { LatestRaw, RequestLogEntry } from '@/lib/api/types';
import type { DataQualityReport } from '@/lib/contract/report';
import type { TypedSend } from '@/lib/messaging/sendTyped';
import { searchStore } from '@/features/search/searchStore';
import { uiStore } from '@/features/shell/uiStore';

export const DEBUG_CANARY = 'kcp-debug-canary';

export interface DiagnosticsData {
  log: RequestLogEntry[];
  report: DataQualityReport | null;
  latestRaw: LatestRaw | null;
}

function countIssues(report: DataQualityReport): number {
  return report.issues.filter((issue) => issue.severity !== 'info').length;
}

export function useDiagnosticsData(send: TypedSend): {
  data: DiagnosticsData;
  refresh: () => void;
} {
  const [data, setData] = useState<DiagnosticsData>({
    log: [],
    report: null,
    latestRaw: null,
  });

  const refresh = useCallback(() => {
    void (async () => {
      const [log, report, raw] = await Promise.all([
        send({ type: 'debug/getRequestLog' }),
        send({ type: 'debug/getReport' }),
        send({ type: 'debug/getLatestRaw' }),
      ]);
      const nextReport = report.ok ? report.value : null;
      setData({
        log: log.ok ? log.value : [],
        report: nextReport,
        latestRaw: raw.ok ? raw.value : null,
      });
      uiStore
        .getState()
        .setDiagnosticsIssueCount(nextReport ? countIssues(nextReport) : null);
    })();
  }, [send]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(
    () =>
      searchStore.subscribe((state, previous) => {
        // Refresh on a terminal result, ready or error: a payload that breaks the
        // hard gate still produced an audit report worth surfacing.
        if (
          state.result !== previous.result &&
          (state.result.status === 'ready' || state.result.status === 'error')
        ) {
          refresh();
        }
      }),
    [refresh],
  );

  return { data, refresh };
}
