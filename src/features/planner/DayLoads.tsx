// The scheduled load per day in plain text, one item per day that holds a meeting. The
// day reads as its short abbreviation on screen and as its full name to assistive
// technology, which would otherwise spell out a single character.

import type { Translate } from '@/lib/i18n/t';
import { WEEK_DAYS } from '@/lib/parsing/days';
import { dayFullLabelKey, dayLabelKey } from '@/lib/i18n/dayLabel';
import type { PerDayLoad } from '@/lib/planner/grid';
import { formatHours } from '@/lib/parsing/time';

interface DayLoadsProps {
  load: PerDayLoad;
  t: Translate;
}

export function DayLoads({ load, t }: DayLoadsProps) {
  return (
    <>
      {WEEK_DAYS.filter((day) => load[day] > 0).map((day) => (
        <span key={day}>
          <span aria-hidden>{t(dayLabelKey(day))}</span>
          <span className="sr-only">{t(dayFullLabelKey(day))}</span>{' '}
          {formatHours(load[day])}
          {t('footer.hourUnit')}
        </span>
      ))}
    </>
  );
}
