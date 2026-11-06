// The plan's exam schedule, the first section of the summary view of ADR-0049. It renders
// the schedule model as text: one section per exam kind, midterm before final, each a list
// of days under a header that names the weekday and the date in the Buddhist year, with
// one row per subject giving the time, the subject id and name, the section codes, and the
// exam detail. A day with two or more subjects carries a neutral same day note. A row whose
// exam collides with another subject's has a danger left edge and names every subject it
// collides with, so the clash is read as text and never by colour alone. A row of a
// section whose open review holds an exam change carries a changed tag. The subjects that
// announce no dated exam close the panel as the arranged by the instructor list. Like the
// grid, it renders only from the plan snapshots.

import { useId } from 'react';
import type { Locale, Translate, TranslationKey } from '@/lib/i18n/t';
import { dayFullLabelKey } from '@/lib/i18n/dayLabel';
import { pickLocalized } from '@/lib/i18n/localize';
import { fillTemplate } from '@/lib/i18n/template';
import type { ExamKind } from '@/lib/planner/examOverlap';
import type {
  ExamDay,
  ExamKindGroup,
  ExamSchedule,
  ExamScheduleRow,
  ExamSubject,
} from '@/lib/planner/examSchedule';
import { Pill } from '@/components/Pill';
import { formatExamDate, formatExamTimes } from './examText';
import { SummarySubSection } from './SummarySubSection';

const KIND_KEY: Record<ExamKind, TranslationKey> = {
  midterm: 'exam.midterm',
  final: 'exam.final',
};

/** The day header: the full weekday name, when the stored date is a real day, then the
 * date in the Buddhist year. */
function dayHeading(day: ExamDay, t: Translate): string {
  const date = formatExamDate(day, t);
  return day.weekday === null
    ? date
    : `${t(dayFullLabelKey(day.weekday))} ${date}`;
}

interface ExamSchedulePanelProps {
  schedule: ExamSchedule;
  locale: Locale;
  t: Translate;
}

export function ExamSchedulePanel({
  schedule,
  locale,
  t,
}: ExamSchedulePanelProps) {
  const headingId = `${useId()}-heading`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h3 id={headingId} className="text-sm font-semibold text-ink">
        {t('examSchedule.title')}
      </h3>
      {schedule.groups.length === 0 ? (
        <p className="text-sm text-ink-soft">{t('examSchedule.noDates')}</p>
      ) : null}
      {schedule.groups.map((group) => (
        <KindSection key={group.kind} group={group} locale={locale} t={t} />
      ))}
      {schedule.selfArranged.length > 0 ? (
        <SummarySubSection title={t('examSchedule.selfArranged')}>
          <ul className="divide-y divide-border rounded-kcp border border-border">
            {schedule.selfArranged.map((subject) => (
              <li key={subject.subjectId} className="px-3 py-2">
                <SubjectLines subject={subject} locale={locale} t={t} />
              </li>
            ))}
          </ul>
        </SummarySubSection>
      ) : null}
    </section>
  );
}

interface KindSectionProps {
  group: ExamKindGroup;
  locale: Locale;
  t: Translate;
}

function KindSection({ group, locale, t }: KindSectionProps) {
  return (
    <SummarySubSection title={t(KIND_KEY[group.kind])}>
      <ol className="flex flex-col gap-2">
        {group.days.map((day) => (
          <li
            key={day.date}
            className="overflow-hidden rounded-kcp border border-border"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 bg-surface-alt px-3 py-1.5">
              <h5 className="text-xs font-semibold text-ink">
                {dayHeading(day, t)}
              </h5>
              {day.sameDayCount === null ? null : (
                <p className="text-xs text-ink-soft">
                  {fillTemplate(t('examSchedule.sameDay'), {
                    count: day.sameDayCount,
                  })}
                </p>
              )}
            </div>
            <ul className="divide-y divide-border">
              {day.rows.map((row) => (
                <ExamRow
                  key={`${row.subjectId} ${row.window.start} ${row.window.end}`}
                  row={row}
                  locale={locale}
                  t={t}
                />
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </SummarySubSection>
  );
}

interface ExamRowProps {
  row: ExamScheduleRow;
  locale: Locale;
  t: Translate;
}

function ExamRow({ row, locale, t }: ExamRowProps) {
  const clashed = row.clashesWith.length > 0;
  return (
    <li
      data-exam-clash={clashed ? 'true' : undefined}
      className={`flex gap-3 border-l-2 py-2 pr-3 pl-2.5 ${
        clashed ? 'border-l-danger' : 'border-l-transparent'
      }`}
    >
      <p className="w-24 shrink-0 text-xs text-ink tabular-nums">
        {formatExamTimes(row.window, t)}
      </p>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <SubjectLines subject={row} locale={locale} t={t} />
        {row.note === null ? null : (
          <p className="break-words whitespace-pre-line text-xs text-ink-soft">
            {row.note}
          </p>
        )}
        {row.clashesWith.map((clash) => (
          <p
            key={clash.teachTableId}
            className="break-words text-xs font-semibold text-danger"
          >
            {fillTemplate(t('examSchedule.clash'), {
              subject: `${clash.subjectId} ${pickLocalized(clash.nameTh, clash.nameEn, locale)}`,
              section: clash.section,
            })}
          </p>
        ))}
      </div>
    </li>
  );
}

interface SubjectLinesProps {
  subject: ExamSubject;
  locale: Locale;
  t: Translate;
}

function SubjectLines({ subject, locale, t }: SubjectLinesProps) {
  return (
    <>
      <p className="flex flex-wrap items-center gap-x-1.5 break-words text-sm text-ink">
        <span>
          <span className="font-semibold tabular-nums">
            {subject.subjectId}
          </span>{' '}
          {pickLocalized(subject.nameTh, subject.nameEn, locale)}
        </span>
        {subject.changed ? (
          <Pill tone="warn">{t('examSchedule.changed')}</Pill>
        ) : null}
      </p>
      <p className="text-xs text-ink-soft tabular-nums">
        {t('section.code')} {subject.sections.join(' ')}
      </p>
    </>
  );
}
