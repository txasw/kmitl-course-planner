// The plan's exam schedule as the lines the poster exam block and the copy as text output
// share, so both read one order and one wording (ADR-0064). The dated rows come first, the
// midterm group before the final group and each in date order as the schedule arranges them,
// then one line per subject that announces no dated exam. A line carries its exam kind label,
// the date and time in the Buddhist year form the rest of the app shows, and the subject named
// through the same display options as every other export line.

import type { DisplayOptions } from '@/lib/planner/displayOptions';
import type { ExamSchedule } from '@/lib/planner/examSchedule';
import type { ExamKind } from '@/lib/planner/examOverlap';
import { subjectText, type PlanTextExamLine } from '@/lib/export/planText';
import type { Locale, Translate, TranslationKey } from '@/lib/i18n/t';
import { formatExamRange } from './examText';

/** A line of the schedule: the text export's exam line plus a key unique within it. */
export interface ExamScheduleLine extends PlanTextExamLine {
  key: string;
}

const KIND_LABEL: Record<ExamKind, TranslationKey> = {
  midterm: 'exam.midterm.short',
  final: 'exam.final.short',
};

/** Flatten an exam schedule into its display lines, in schedule order. */
export function examScheduleLines(
  schedule: ExamSchedule,
  options: DisplayOptions,
  locale: Locale,
  t: Translate,
): ExamScheduleLine[] {
  const dated = schedule.groups.flatMap((group) =>
    group.days.flatMap((day) =>
      day.rows.map((row) => ({
        key: `${group.kind} ${row.subjectId} ${row.window.start} ${row.window.end}`,
        label: t(KIND_LABEL[group.kind]),
        when: formatExamRange(row.window, t),
        subject: subjectText(row, row.sections, options, locale),
      })),
    ),
  );
  const selfArranged = schedule.selfArranged.map((subject) => ({
    key: `self ${subject.subjectId}`,
    label: t('exam.selfArranged'),
    when: null,
    subject: subjectText(subject, subject.sections, options, locale),
  }));
  return [...dated, ...selfArranged];
}
