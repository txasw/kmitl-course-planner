// The exam overlap wording, kept in one place so the feedback strip and the block
// popover phrase an exam clash the same way, the way conflictText serves the time
// conflict. It is a warning, so its sentence names the clashing subject, section, and
// exam kind, distinct from a blocking time conflict; formatExamRange renders the two
// windows the popover shows.

import type { DateRange } from '@/lib/domain/types';
import type { Translate } from '@/lib/i18n/t';
import type { ExamWarningFeedback } from './dragStore';

/** The strip sentence for an exam overlap surfaced after a successful add: the first
 * clashing subject, section, and exam kind, with a count suffix when more follow. */
export function examOverlapText(
  feedback: ExamWarningFeedback,
  t: Translate,
): string {
  const first = feedback.overlaps[0];
  if (first === undefined) {
    return t('verify.examOverlap');
  }
  const more = feedback.overlaps.length - 1;
  const suffix = more > 0 ? ` (+${String(more)})` : '';
  return `${t('feedback.examOverlap')} ${first.blocking.subjectId} ${t('section.code')} ${first.blocking.section} ${t(`exam.${first.kind}`)}${suffix}`;
}

function splitDateTime(value: string): { date: string; time: string } | null {
  const match = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}):\d{2}$/.exec(value);
  if (match === null) {
    return null;
  }
  const date = match[1];
  const time = match[2];
  if (date === undefined || time === undefined) {
    return null;
  }
  return { date, time };
}

/** A compact "YYYY-MM-DD HH:MM-HH:MM" when both ends fall on one day, or the two
 * datetimes side by side when they span days. Seconds are dropped. Falls back to the raw
 * strings when a value is not the expected shape. */
export function formatExamRange(range: DateRange): string {
  const start = splitDateTime(range.start);
  const end = splitDateTime(range.end);
  if (start === null || end === null) {
    return `${range.start} ${range.end}`;
  }
  if (start.date === end.date) {
    return `${start.date} ${start.time}-${end.time}`;
  }
  return `${start.date} ${start.time} ${end.date} ${end.time}`;
}
