// The scheduled load per day in plain text, one item per day that holds a meeting. The
// day reads as its short abbreviation on screen and as its full name to assistive
// technology, which would otherwise spell out a single character. The hours carry the
// locale's unit spacing, 6 ชม. in Thai and 6h in English.

import type { Locale, Translate } from '@/lib/i18n/t';
import { hoursText } from '@/lib/i18n/hours';
import { WEEK_DAYS } from '@/lib/parsing/days';
import { dayFullLabelKey, dayLabelKey } from '@/lib/i18n/dayLabel';
import type { PerDayLoad } from '@/lib/planner/grid';

interface DayLoadsProps {
  load: PerDayLoad;
  locale: Locale;
  t: Translate;
}

export function DayLoads({ load, locale, t }: DayLoadsProps) {
  return (
    <>
      {WEEK_DAYS.filter((day) => load[day] > 0).map((day) => (
        <span key={day}>
          <span aria-hidden>{t(dayLabelKey(day))}</span>
          <span className="sr-only">{t(dayFullLabelKey(day))}</span>{' '}
          {hoursText(load[day], locale, t)}
        </span>
      ))}
    </>
  );
}
