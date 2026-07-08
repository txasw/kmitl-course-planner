// Debug only. The four diagnostics views: the request log, the data quality
// report grouped by field path, the raw versus normalized payload, and the
// simulation controls. Copy is hardcoded English because the diagnostics ship
// only in debug builds and are never user facing, so they stay out of the
// production dictionaries. This module ships only in the debug chunk and embeds
// the canary the production bundle check greps for.

import { useState } from 'react';
import { useStore } from 'zustand';
import type { LatestRaw, RequestLogEntry, SimSettings } from '@/lib/api/types';
import type { DataQualityReport } from '@/lib/contract/report';
import { FAULT_PRESETS } from '@/lib/api/debug/faults';
import { MUTATION_PRESETS } from '@/lib/contract/mutations';
import { searchStore } from '@/features/search/searchStore';

export const DEBUG_CANARY = 'kcp-debug-canary';

const CELL = 'border border-border px-1.5 py-1 text-left align-top';

export function RequestLogView({ log }: { log: RequestLogEntry[] }) {
  if (log.length === 0) {
    return <p className="text-sm text-ink-soft">No requests yet</p>;
  }
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr>
          <th className={CELL}>Endpoint</th>
          <th className={CELL}>ms</th>
          <th className={CELL}>Cache</th>
          <th className={CELL}>Retries</th>
          <th className={CELL}>Status</th>
          <th className={CELL}>Issues</th>
        </tr>
      </thead>
      <tbody>
        {log.map((entry, index) => (
          <tr key={`${entry.endpoint}-${String(index)}`}>
            <td className={CELL}>{entry.endpoint}</td>
            <td className={CELL}>{entry.durationMs}</td>
            <td className={CELL}>{entry.cacheHit ? 'hit' : 'miss'}</td>
            <td className={CELL}>{entry.retryCount}</td>
            <td className={CELL}>{entry.status ?? 'none'}</td>
            <td className={CELL}>{entry.issueCount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ReportView({ report }: { report: DataQualityReport | null }) {
  if (report === null) {
    return <p className="text-sm text-ink-soft">No report yet</p>;
  }
  return (
    <div className="flex flex-col gap-2 text-xs">
      <p className="text-ink-soft">
        rows {report.totals.rows} deduped {report.totals.deduped} issues{' '}
        {report.totals.issues}
      </p>
      {report.aggregates.length === 0 ? (
        <p className="text-ink-soft">No issues in the latest report</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={CELL}>Path</th>
              <th className={CELL}>Kind</th>
              <th className={CELL}>Count</th>
              <th className={CELL}>Samples</th>
            </tr>
          </thead>
          <tbody>
            {report.aggregates.map((aggregate) => (
              <tr key={`${aggregate.path}-${aggregate.kind}`}>
                <td className={CELL}>{aggregate.path}</td>
                <td className={CELL}>{aggregate.kind}</td>
                <td className={CELL}>{aggregate.count}</td>
                <td className={CELL}>{aggregate.samples.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const PRE =
  'max-h-96 overflow-auto rounded-kcp border border-border bg-surface-alt p-2 text-xs';

export function RawNormalizedView({
  latestRaw,
}: {
  latestRaw: LatestRaw | null;
}) {
  const result = useStore(searchStore, (state) => state.result);
  const normalized = result.status === 'ready' ? result.data : null;
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="flex flex-col gap-1">
        <h4 className="text-xs font-semibold text-ink">Raw</h4>
        <pre className={PRE}>
          {latestRaw
            ? JSON.stringify(latestRaw.raw, null, 2)
            : 'No raw payload'}
        </pre>
      </div>
      <div className="flex flex-col gap-1">
        <h4 className="text-xs font-semibold text-ink">Normalized</h4>
        <pre className={PRE}>
          {normalized
            ? JSON.stringify(normalized, null, 2)
            : 'No normalized result'}
        </pre>
      </div>
    </div>
  );
}

const SELECT =
  'rounded-kcp border border-border bg-surface px-2 py-1.5 text-ink focus:ring-2 focus:ring-primary focus:outline-none';

interface SimulationControlsProps {
  simulation: SimSettings;
  onSetFault: (id: string | null) => void;
  onSetMutation: (id: string | null) => void;
}

export function SimulationControls({
  simulation,
  onSetFault,
  onSetMutation,
}: SimulationControlsProps) {
  // Seeded from the worker state so a return to this tab rehydrates the current
  // selection rather than showing none while a simulation is still armed.
  const [fault, setFault] = useState(simulation.faultId ?? '');
  const [mutation, setMutation] = useState(simulation.mutationId ?? '');
  return (
    <div className="flex flex-col gap-3 text-sm">
      <label className="flex flex-col gap-1">
        <span className="font-medium text-ink">Fault</span>
        <select
          value={fault}
          className={SELECT}
          onChange={(event) => {
            const id = event.target.value;
            setFault(id);
            onSetFault(id === '' ? null : id);
          }}
        >
          <option value="">None</option>
          {FAULT_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium text-ink">Mutation</span>
        <select
          value={mutation}
          className={SELECT}
          onChange={(event) => {
            const id = event.target.value;
            setMutation(id);
            onSetMutation(id === '' ? null : id);
          }}
        >
          <option value="">None</option>
          {MUTATION_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-ink-soft">
        Applies to the next query. The fixture source arrives once fixtures are
        bundled into the debug build.
      </p>
    </div>
  );
}
