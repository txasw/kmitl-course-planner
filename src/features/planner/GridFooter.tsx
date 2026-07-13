// The timetable footer summary: total credits including unscheduled sections, the
// distinct subject count, the scheduled load per day in plain text, and the count
// of unscheduled sections when the plan holds any.

import type { Translate } from '@/lib/i18n/t';
import { WEEK_DAYS } from '@/lib/parsing/days';
import { dayLabelKey } from '@/lib/i18n/dayLabel';
import { summarizeCredits } from '@/lib/planner/credits';
import { perDayLoad } from '@/lib/planner/grid';
import type { PlacedSection } from './placedSection';

const MINUTES_PER_HOUR = 60;

function formatHours(minutes: number): string {
  const hours = minutes / MINUTES_PER_HOUR;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

interface GridFooterProps {
  sections: PlacedSection[];
  t: Translate;
  /** Drop the top divider and padding when the footer sits inside a bordered poster row that
   * already carries them, as in the preview footer baseline row. */
  flush?: boolean;
}

export function GridFooter({ sections, t, flush = false }: GridFooterProps) {
  const credits = summarizeCredits(
    sections.map((section) => ({
      subjectId: section.subjectId,
      credit: section.credit,
    })),
  );
  const load = perDayLoad(sections.flatMap((section) => section.meetings));
  const unscheduled = sections.filter(
    (section) => section.meetings.length === 0,
  ).length;

  return (
    <div
      role="group"
      aria-label={t('footer.summary')}
      className={`flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft ${
        flush ? '' : 'border-t border-border pt-2'
      }`}
    >
      <span className="font-medium text-ink">
        {credits.credits} {t('footer.credits')}
      </span>
      <span>
        {credits.subjects} {t('footer.subjects')}
      </span>
      {WEEK_DAYS.filter((day) => load[day] > 0).map((day) => (
        <span key={day}>
          {t(dayLabelKey(day))} {formatHours(load[day])}
          {t('footer.hourUnit')}
        </span>
      ))}
      {unscheduled > 0 ? (
        <span>
          {unscheduled} {t('footer.unscheduled')}
        </span>
      ) : null}
    </div>
  );
}
