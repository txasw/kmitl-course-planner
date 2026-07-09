// The revalidation summary banner above the grid. It reports the latest check for the
// active plan in one line and offers a refresh that reruns the check, or a retry when
// the check could not reach the service. A manual refresh reports here rather than
// through the toast, so the outcome stays next to the plan it describes. It renders in
// both edit and preview, since correctness matters most at the moment of sharing.

import { useStore } from 'zustand';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useSearchDeps } from '@/features/search/SearchDepsContext';
import { useTranslation } from '@/features/shell/useTranslation';
import { useActivePlan } from '@/features/plans/planStore';
import { revalidationStore } from '@/features/plans/revalidationStore';
import { revalidatePlanNow } from '@/features/plans/revalidationController';

export function RevalidationBanner() {
  const { t } = useTranslation();
  const { send } = useSearchDeps();
  const activePlan = useActivePlan();
  const runs = useStore(revalidationStore, (state) => state.runs);

  if (activePlan === null) {
    return null;
  }
  const run = runs[activePlan.id];
  if (run === undefined) {
    return null;
  }

  const refresh = (): void => {
    void revalidatePlanNow(
      activePlan,
      { send, now: () => new Date().toISOString() },
      true,
    );
  };

  if (run.status === 'running') {
    return (
      <div className="flex shrink-0 items-center gap-2 rounded-kcp border border-border bg-surface-alt px-2 py-1 text-xs text-ink-soft">
        <RefreshCw
          size={12}
          strokeWidth={2}
          aria-hidden
          className="animate-spin motion-reduce:animate-none"
        />
        <span>{t('revalidation.checking')}</span>
      </div>
    );
  }

  if (run.status === 'offline' || run.report === null) {
    return (
      <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-kcp border border-warn bg-primary-soft px-2 py-1 text-xs text-ink">
        <AlertTriangle size={12} strokeWidth={2} aria-hidden />
        <span>{t('revalidation.offline')}</span>
        <RefreshButton label={t('action.retry')} onClick={refresh} />
      </div>
    );
  }

  const { summary } = run.report;
  const clean = summary.changed === 0 && summary.missing === 0;

  return (
    <div
      aria-live="polite"
      className="flex shrink-0 flex-wrap items-center gap-2 rounded-kcp border border-border bg-surface-alt px-2 py-1 text-xs text-ink"
    >
      <span>
        {t('revalidation.checked')} {summary.total}
        {summary.changed > 0
          ? ` ${t('revalidation.changed')} ${String(summary.changed)}`
          : ''}
        {summary.missing > 0
          ? ` ${t('revalidation.missing')} ${String(summary.missing)}`
          : ''}
        {clean ? ` ${t('revalidation.allMatch')}` : ''}
      </span>
      {run.status === 'partial' ? (
        <span className="text-warn">{t('revalidation.partial')}</span>
      ) : null}
      <RefreshButton label={t('catalog.refresh')} onClick={refresh} />
    </div>
  );
}

function RefreshButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-kcp border border-border bg-surface px-2 py-0.5 font-medium text-ink outline-none hover:bg-surface-alt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <RefreshCw size={12} strokeWidth={2} aria-hidden />
      {label}
    </button>
  );
}
