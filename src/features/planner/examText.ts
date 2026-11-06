// The exam date range wording, kept in one place so the blocked reason, the block
// popover, and the section detail list render an exam window the same way. The year is
// the Buddhist year the app shows in both locales, converted from the stored Gregorian
// year without a naive Date, and the month name is localized through t.

import type { DateRange, Exam } from '@/lib/domain/types';
import { EXAM_KINDS, type ExamKind } from '@/lib/planner/examOverlap';
import type { Translate } from '@/lib/i18n/t';
import { toBuddhistYear } from '@/lib/routing/academicTerms';
import {
  parseExamDateTime,
  type ExamDateParts,
} from '@/lib/parsing/examDateTime';
import { monthKey } from '@/lib/i18n/monthLabel';

const pad = (value: number): string => String(value).padStart(2, '0');

const clock = (parts: ExamDateParts): string =>
  `${pad(parts.hour)}:${pad(parts.minute)}`;

const sameDay = (a: ExamDateParts, b: ExamDateParts): boolean =>
  a.yearCE === b.yearCE && a.month === b.month && a.day === b.day;

/** A calendar day as "D MMM BE": the month localized through t and the stored Gregorian
 * year shown as the Buddhist year, as every exam date in the app reads. */
export function formatExamDate(
  parts: Pick<ExamDateParts, 'yearCE' | 'month' | 'day'>,
  t: Translate,
): string {
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
  const startTime = clock(start);
  const endTime = clock(end);
  if (sameDay(start, end)) {
    return `${formatExamDate(start, t)} ${startTime}-${endTime}`;
  }
  return `${formatExamDate(start, t)} ${startTime} ${formatExamDate(end, t)} ${endTime}`;
}

/** The clock times of a window listed under its start day: "HH:MM-HH:MM" when both ends
 * fall on that day, or the full range through formatExamRange when it runs into another
 * day, so the end date is never hidden. */
export function formatExamTimes(range: DateRange, t: Translate): string {
  const start = parseExamDateTime(range.start);
  const end = parseExamDateTime(range.end);
  if (start === null || end === null || !sameDay(start, end)) {
    return formatExamRange(range, t);
  }
  return `${clock(start)}-${clock(end)}`;
}

/** One announced exam window of a section, labelled by its kind and formatted. */
export interface ExamWindowText {
  kind: ExamKind;
  text: string;
}

/** The exam windows a section announces, midterm before final, each formatted through
 * formatExamRange. A window the API left empty is absent, so an empty list means the
 * section announces no exam date, which the surfaces read as arranged by the instructor.
 * It takes the windows of a section or of a stored snapshot, whose optional fields may
 * hold undefined. */
export function examWindowTexts(
  exam: { readonly [K in keyof Exam]?: Exam[K] | undefined },
  t: Translate,
): ExamWindowText[] {
  return EXAM_KINDS.flatMap((kind) => {
    const range = exam[kind];
    return range === undefined
      ? []
      : [{ kind, text: formatExamRange(range, t) }];
  });
}

/** A moment the app recorded itself, such as the last verification, in the same
 * "D MMM BE HH:MM" form an exam date reads, so one detail list never mixes two date
 * conventions. It reads the local calendar fields of the Date, since the stored value
 * is an ISO instant rather than the API's fixed width exam string. */
export function formatLocalDateTime(date: Date, t: Translate): string {
  const parts: ExamDateParts = {
    yearCE: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
  };
  return `${formatExamDate(parts, t)} ${clock(parts)}`;
}
