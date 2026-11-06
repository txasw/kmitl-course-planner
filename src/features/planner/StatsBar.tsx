// The edit mode plan summary, a bar pinned to the foot of the plan region. It states the
// credits as the lead number, the distinct subject count, whether any section pair clashes,
// the scheduled load per day, the count of sections with no meeting when the plan holds any,
// and at the end the verification status the panel slots in. A clash is the one item the
// student acts on, so it is a danger button that points at the first clashing section on
// the timetable; with none the bar says so quietly with a check. The poster states the same
// totals in its own footer line, without the clash control.

import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { Translate } from '@/lib/i18n/t';
import { fillTemplate } from '@/lib/i18n/template';
import { FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_SIZE } from '@/lib/ui/target';
import { DayLoads } from './DayLoads';
import { planTotals } from './planTotals';
import type { PlacedSection } from './placedSection';

interface StatsBarProps {
  sections: PlacedSection[];
  /** Distinct section pairs that clash on time or on an exam window. */
  conflictCount: number;
  /** Bring the first clashing section into view and focus it. */
  onShowConflict: () => void;
  /** The verification status, pushed to the end of the bar. */
  status?: ReactNode;
  t: Translate;
}

const NUMBER = 'text-base font-semibold tabular-nums text-ink';

export function StatsBar({
  sections,
  conflictCount,
  onShowConflict,
  status,
  t,
}: StatsBarProps) {
  const totals = planTotals(sections);

  return (
    <div
      role="group"
      aria-label={t('stats.region')}
      className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-2 text-xs text-ink-soft"
    >
      <span>
        <span className={NUMBER}>{totals.credits}</span> {t('footer.credits')}
      </span>
      <span>
        <span className={NUMBER}>{totals.subjects}</span> {t('footer.subjects')}
      </span>
      {conflictCount > 0 ? (
        <button
          type="button"
          onClick={onShowConflict}
          className={`inline-flex items-center gap-1 rounded-kcp border border-danger bg-surface px-2 py-0.5 text-danger hover:bg-danger-soft ${TARGET_SIZE} ${FOCUS_RING}`}
        >
          <AlertTriangle size={14} strokeWidth={2} aria-hidden />
          {fillTemplate(t('stats.conflicts'), { count: conflictCount })}
        </button>
      ) : (
        <span className="inline-flex items-center gap-1">
          <CheckCircle2 size={14} strokeWidth={2} aria-hidden />
          {t('stats.noConflicts')}
        </span>
      )}
      <DayLoads load={totals.load} t={t} />
      {totals.unscheduled > 0 ? (
        <span>
          {totals.unscheduled} {t('footer.unscheduled')}
        </span>
      ) : null}
      {status === undefined ? null : <span className="ml-auto">{status}</span>}
    </div>
  );
}
