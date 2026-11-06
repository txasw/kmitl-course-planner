// The timetable footer summary: total credits including unscheduled sections, the
// distinct subject count, the scheduled load per day in plain text, and the count
// of unscheduled sections when the plan holds any.

import type { Translate } from '@/lib/i18n/t';
import { DayLoads } from './DayLoads';
import { planTotals } from './planTotals';
import type { PlacedSection } from './placedSection';

interface GridFooterProps {
  sections: PlacedSection[];
  t: Translate;
  /** Drop the top divider and padding when the footer sits inside a bordered poster row that
   * already carries them, as in the preview footer baseline row. */
  flush?: boolean;
}

export function GridFooter({ sections, t, flush = false }: GridFooterProps) {
  const totals = planTotals(sections);

  return (
    <div
      role="group"
      aria-label={t('footer.summary')}
      className={`flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft ${
        flush ? '' : 'border-t border-border pt-2'
      }`}
    >
      <span className="font-semibold text-ink">
        {totals.credits} {t('footer.credits')}
      </span>
      <span>
        {totals.subjects} {t('footer.subjects')}
      </span>
      <DayLoads load={totals.load} t={t} />
      {totals.unscheduled > 0 ? (
        <span>
          {totals.unscheduled} {t('footer.unscheduled')}
        </span>
      ) : null}
    </div>
  );
}
