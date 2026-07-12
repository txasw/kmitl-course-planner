// The exam date range wording, kept in one place so the blocked reason and the block
// popover render an exam window the same way. The year is the Buddhist year the app shows
// in both locales, converted from the stored Gregorian year without a naive Date, and the
// month name is localized through t.

import type { DateRange } from '@/lib/domain/types';
import type { Translate } from '@/lib/i18n/t';
import { toBuddhistYear } from '@/lib/routing/academicTerms';
import {
  parseExamDateTime,
  type ExamDateParts,
} from '@/lib/parsing/examDateTime';
import { monthKey } from '@/lib/i18n/monthLabel';

const pad = (value: number): string => String(value).padStart(2, '0');

function formatExamDate(parts: ExamDateParts, t: Translate): string {
  const key = monthKey(parts.month);
  const month = key === null ? pad(parts.month) : t(key);
  // The Buddhist year is the app's display convention in both locales; the month name is
  // localized through t. The stored year is Gregorian, so convert it here rather than at
  // the source, and never through a naive Date.
  return `${String(parts.day)} ${month} ${String(toBuddhistYear(parts.yearCE))}`;
}

/** A locale aware "D MMM BE HH:MM-HH:MM" when both ends fall on one day, or the two
 * datetimes side by side when they span days. The year is the Buddhist year the app shows
 * in both locales and the month name is localized through t; seconds are dropped. Falls
 * back to the raw strings when a value is not the expected shape, never a naive Date. */
export function formatExamRange(range: DateRange, t: Translate): string {
  const start = parseExamDateTime(range.start);
  const end = parseExamDateTime(range.end);
  if (start === null || end === null) {
    return `${range.start} ${range.end}`;
  }
  const startTime = `${pad(start.hour)}:${pad(start.minute)}`;
  const endTime = `${pad(end.hour)}:${pad(end.minute)}`;
  const sameDay =
    start.yearCE === end.yearCE &&
    start.month === end.month &&
    start.day === end.day;
  if (sameDay) {
    return `${formatExamDate(start, t)} ${startTime}-${endTime}`;
  }
  return `${formatExamDate(start, t)} ${startTime} ${formatExamDate(end, t)} ${endTime}`;
}
