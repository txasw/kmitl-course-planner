// Exam datetimes arrive as the API's fixed width "YYYY-MM-DD HH:MM:SS" in the Gregorian
// (CE) era. This is verified against the live with-exams capture, whose values are all in
// 2026 for the 2569 Buddhist academic year, so the stored year is CE and never Buddhist.
// Ordering is a lexicographic compare of the raw string, which is chronological within one
// era and needs no parser. Reading the fields extracts them directly rather than round
// tripping through a naive Date, which misreads the space separated form on some engines
// and cannot be trusted to hold the era. Display converts the CE year to the Buddhist year
// the app shows in both locales; that conversion is the caller's, not this module's.

/** The fixed width datetime the exam fields carry: "YYYY-MM-DD HH:MM:SS", a Gregorian year.
 * The single source of the format, used by the overlap gate, the normalizer warning, and
 * the contract auditor so the shape is asserted in one place. */
export const EXAM_DATETIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

/** Whether a value is a well formed exam datetime. A value that fails is treated as no
 * window by the gate and, when it was non null, recorded as a normalization warning so a
 * format drift is observable rather than silent. */
export function isExamDateTime(value: string): boolean {
  return EXAM_DATETIME.test(value);
}

/** The fields of an exam datetime. `yearCE` is the Gregorian year exactly as received; the
 * Buddhist year for display is `yearCE + 543`. */
export interface ExamDateParts {
  yearCE: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const PARTS = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):\d{2}$/;

/** Extract the fields of a "YYYY-MM-DD HH:MM:SS" datetime without constructing a Date.
 * Returns null when the value is not the expected shape. */
export function parseExamDateTime(value: string): ExamDateParts | null {
  const match = PARTS.exec(value);
  if (match === null) {
    return null;
  }
  const [, year, month, day, hour, minute] = match;
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hour === undefined ||
    minute === undefined
  ) {
    return null;
  }
  return {
    yearCE: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
  };
}
