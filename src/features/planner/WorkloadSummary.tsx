// The plan's weekly workload, the section of the summary view after the exam schedule. It
// states the lecture, practice, and self study hours the credit notations give, the class
// time each day, the weekdays with no class, and the breaks of three hours or more between
// two classes, as in วันพฤหัสบดี ว่าง 10:00 ถึง 13:00. Students plan around a day off or a
// long break, and the timetable shows neither as text. Every day reads as its full name, so
// nothing depends on a short form. Like the grid, it renders only from the plan snapshots,
// and none of it reaches the poster.

import { useId } from 'react';
import type { Translate, TranslationKey } from '@/lib/i18n/t';
import { dayFullLabelKey } from '@/lib/i18n/dayLabel';
import { fillTemplate } from '@/lib/i18n/template';
import { WEEK_DAYS } from '@/lib/parsing/days';
import { formatHours, formatMinutes } from '@/lib/parsing/time';
import type { WeeklyHours } from '@/lib/planner/credits';
import {
  computeFreePeriods,
  LONG_GAP_MIN,
  type MeetingSpan,
} from '@/lib/planner/freePeriods';
import { perDayLoad } from '@/lib/planner/grid';
import { SummarySubSection } from './SummarySubSection';

const HOUR_KINDS: readonly {
  key: TranslationKey;
  field: 'lecture' | 'practice' | 'selfStudy';
}[] = [
  { key: 'workload.lecture', field: 'lecture' },
  { key: 'workload.practice', field: 'practice' },
  { key: 'workload.selfStudy', field: 'selfStudy' },
];

const NOTE = 'text-sm text-ink-soft';

interface WorkloadSummaryProps {
  hours: WeeklyHours;
  /** The plan's scheduled meetings; an unscheduled section adds none. */
  meetings: readonly MeetingSpan[];
  t: Translate;
}

export function WorkloadSummary({ hours, meetings, t }: WorkloadSummaryProps) {
  const headingId = `${useId()}-heading`;
  const load = perDayLoad(meetings);
  const loadedDays = WEEK_DAYS.filter((day) => load[day] > 0);
  const { freeDays, gaps } = computeFreePeriods(meetings);
  const gapHours = { hours: formatHours(LONG_GAP_MIN) };

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h3 id={headingId} className="text-sm font-semibold text-ink">
        {t('workload.title')}
      </h3>

      <SummarySubSection title={t('workload.hoursTitle')}>
        <dl className="grid grid-cols-3 gap-2">
          {HOUR_KINDS.map(({ key, field }) => (
            <div
              key={field}
              className="flex flex-col gap-0.5 rounded-kcp border border-border px-3 py-2"
            >
              <dt className="text-xs text-ink-soft">{t(key)}</dt>
              <dd className="text-base font-semibold text-ink tabular-nums">
                {fillTemplate(t('workload.hours'), {
                  hours: formatHours(hours[field] * 60),
                })}
              </dd>
            </div>
          ))}
        </dl>
        {hours.unstated > 0 ? (
          <p className="text-xs text-ink-soft">
            {fillTemplate(t('workload.unstated'), { count: hours.unstated })}
          </p>
        ) : null}
      </SummarySubSection>

      <SummarySubSection title={t('workload.perDayTitle')}>
        {loadedDays.length === 0 ? (
          <p className={NOTE}>{t('workload.noMeetings')}</p>
        ) : (
          <dl className="grid grid-cols-[max-content_auto] gap-x-4 gap-y-1 text-sm">
            {loadedDays.map((day) => (
              <div key={day} className="contents">
                <dt className="text-ink">{t(dayFullLabelKey(day))}</dt>
                <dd className="text-ink tabular-nums">
                  {fillTemplate(t('workload.hours'), {
                    hours: formatHours(load[day]),
                  })}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </SummarySubSection>

      <SummarySubSection title={t('workload.freeDaysTitle')}>
        {freeDays.length === 0 ? (
          <p className={NOTE}>{t('workload.noFreeDays')}</p>
        ) : (
          <ul className="flex flex-wrap gap-2 text-sm">
            {freeDays.map((day) => (
              <li
                key={day}
                className="rounded-kcp-inner bg-surface-alt px-2 py-0.5 text-ink"
              >
                {t(dayFullLabelKey(day))}
              </li>
            ))}
          </ul>
        )}
      </SummarySubSection>

      <SummarySubSection
        title={fillTemplate(t('workload.gapsTitle'), gapHours)}
      >
        {gaps.length === 0 ? (
          <p className={NOTE}>{fillTemplate(t('workload.noGaps'), gapHours)}</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm text-ink tabular-nums">
            {gaps.map((gap) => (
              <li key={`${String(gap.day)}-${String(gap.startMin)}`}>
                {fillTemplate(t('workload.gap'), {
                  day: t(dayFullLabelKey(gap.day)),
                  start: formatMinutes(gap.startMin),
                  end: formatMinutes(gap.endMin),
                })}
              </li>
            ))}
          </ul>
        )}
      </SummarySubSection>
    </section>
  );
}
