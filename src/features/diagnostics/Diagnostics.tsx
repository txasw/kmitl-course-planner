// Debug only. A self contained floating trigger and slide over drawer with the
// four diagnostics views, a refresh, and report export and copy as fixture. It is
// kept independent of the production overlay and header so no diagnostics code
// enters their graph; it mounts through the DiagnosticsGate dynamic import, which
// the production build eliminates. This module ships only in the debug chunk and
// embeds the canary the production bundle check greps for. Copy is hardcoded
// English because the drawer is never user facing.

import { useState } from 'react';
import { Bug, RefreshCw, X } from 'lucide-react';
import { useSearchDeps } from '@/features/search/SearchDepsContext';
import { isSimulationArmed, useDiagnosticsData } from './useDiagnosticsData';
import {
  RawNormalizedView,
  ReportView,
  RequestLogView,
  SimulationControls,
} from './views';

export const DEBUG_CANARY = 'kcp-debug-canary';

type Tab = 'requests' | 'report' | 'raw' | 'simulation';

const TABS: { id: Tab; label: string }[] = [
  { id: 'requests', label: 'Requests' },
  { id: 'report', label: 'Data quality' },
  { id: 'raw', label: 'Raw vs normalized' },
  { id: 'simulation', label: 'Simulation' },
];

function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

const ACTION =
  'rounded-kcp border border-border px-2 py-1 text-xs font-medium text-ink hover:bg-surface-alt focus:ring-2 focus:ring-primary focus:outline-none';

export function Diagnostics() {
  const { send } = useSearchDeps();
  const { data, refresh } = useDiagnosticsData(send);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('requests');

  const armed = isSimulationArmed(data.simulation);

  const setFault = (faultId: string | null) => {
    void send({ type: 'debug/setFault', faultId });
    refresh();
  };
  const setMutation = (mutationId: string | null) => {
    void send({ type: 'debug/setMutation', mutationId });
    refresh();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
        aria-label={armed ? 'Diagnostics, simulation armed' : 'Diagnostics'}
        className="fixed bottom-5 left-5 z-[2147483647] inline-flex items-center gap-2 rounded-kcp border border-border bg-surface px-3 py-2 text-sm font-medium text-ink shadow-kcp hover:bg-surface-alt focus:ring-2 focus:ring-primary focus:outline-none"
      >
        <Bug size={16} strokeWidth={2} aria-hidden />
        Diagnostics
        {armed ? (
          <span
            aria-hidden
            className="absolute -top-1 -right-1 size-2.5 rounded-full bg-warn"
          />
        ) : null}
      </button>
    );
  }

  return (
    <aside
      aria-label="Diagnostics"
      className="fixed inset-y-0 right-0 z-[2147483647] flex w-[520px] max-w-[95%] flex-col bg-surface text-ink shadow-kcp"
    >
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-sm font-semibold">Diagnostics</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={refresh}
            aria-label="Refresh"
            className={ACTION}
          >
            <RefreshCw size={14} strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
            }}
            aria-label="Close diagnostics"
            className={ACTION}
          >
            <X size={14} strokeWidth={2} aria-hidden />
          </button>
        </div>
      </header>

      <div
        role="group"
        aria-label="Views"
        className="flex gap-1 border-b border-border p-2"
      >
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-pressed={tab === entry.id}
            onClick={() => {
              setTab(entry.id);
            }}
            className={`inline-flex items-center gap-1 rounded-kcp px-2 py-1 text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none ${
              tab === entry.id
                ? 'bg-primary text-surface'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            {entry.label}
            {entry.id === 'simulation' && armed ? (
              <span aria-hidden className="size-2 rounded-full bg-warn" />
            ) : null}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {tab === 'requests' ? <RequestLogView log={data.log} /> : null}
        {tab === 'report' ? <ReportView report={data.report} /> : null}
        {tab === 'raw' ? (
          <RawNormalizedView latestRaw={data.latestRaw} />
        ) : null}
        {tab === 'simulation' ? (
          <SimulationControls
            simulation={data.simulation}
            onSetFault={setFault}
            onSetMutation={setMutation}
          />
        ) : null}
      </div>

      <footer className="flex gap-2 border-t border-border p-2">
        <button
          type="button"
          disabled={data.report === null}
          onClick={() => {
            if (data.report !== null) {
              downloadJson('kcp-report.json', data.report);
            }
          }}
          className={`${ACTION} disabled:opacity-50`}
        >
          Export report
        </button>
        <button
          type="button"
          disabled={data.latestRaw === null}
          onClick={() => {
            if (data.latestRaw !== null) {
              void navigator.clipboard.writeText(
                JSON.stringify(data.latestRaw.raw, null, 2),
              );
            }
          }}
          className={`${ACTION} disabled:opacity-50`}
        >
          Copy as fixture
        </button>
      </footer>
    </aside>
  );
}
