// The poster footer summary: total credits including unscheduled sections, the distinct
// subject count, the scheduled load per day in plain text, and the count of unscheduled
// sections when the plan holds any. It is one quiet text line with no divider of its
// own, since it shares the poster footer row that carries the divider. Edit mode states
// the same totals in the stats bar.

import type { Locale, Translate } from '@/lib/i18n/t';
import { DayLoads } from './DayLoads';
import { planTotals } from './planTotals';
import type { PlacedSection } from './placedSection';

interface GridFooterProps {
  sections: PlacedSection[];
  locale: Locale;
  t: Translate;
}

export function GridFooter({ sections, locale, t }: GridFooterProps) {
  const totals = planTotals(sections);

  return (
    <div
      role="group"
      aria-label={t('footer.summary')}
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft"
    >
      <span className="font-semibold text-ink">
        {totals.credits} {t('footer.credits')}
      </span>
      <span>
        {totals.subjects} {t('footer.subjects')}
      </span>
      <DayLoads load={totals.load} locale={locale} t={t} />
      {totals.unscheduled > 0 ? (
        <span>
          {totals.unscheduled} {t('footer.unscheduled')}
        </span>
      ) : null}
    </div>
  );
}
