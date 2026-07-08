// Day of week domain type and the single mapping from the API `teach_day` field.
//
// The API sends `teach_day` as a 1 based digit string where 1 is Sunday through
// 7 is Saturday. The domain uses 0 based `DayOfWeek` where 0 is Sunday. The
// mapping below is empirically confirmed, not assumed: the by_class capture
// carries subjects 90642033/905, 90642129/902, and 90643016/904 with
// `teach_day` "6", and the owner-46 result snapshot renders those exact sections
// under the Thai day name for Friday. See days.test.ts and ADR-0015 for the
// evidence. This is the one place the mapping is declared.

/** 0 = Sunday, 1 = Monday, ... 6 = Saturday. */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** API `teach_day` digit string to domain `DayOfWeek`. */
export const DAY_MAP: ReadonlyMap<string, DayOfWeek> = new Map<
  string,
  DayOfWeek
>([
  ['1', 0],
  ['2', 1],
  ['3', 2],
  ['4', 3],
  ['5', 4],
  ['6', 5],
  ['7', 6],
]);

/**
 * The `teach_day` value the API sends for a course with no scheduled meeting,
 * such as an online or asynchronous course. It comes with `teach_time` and
 * `teach_time2` of `00:00:00`. Confirmed against live exports of the all curricula
 * query, which returns these unscheduled rows that narrower queries omit.
 */
export const UNSCHEDULED_DAY = '0';

/** The `teach_time` and `teach_time2` an unscheduled row carries. */
export const UNSCHEDULED_TIME = '00:00:00';

/** Whether a raw `teach_day` marks an unscheduled row rather than a real day. */
export function isUnscheduledDay(raw: string): boolean {
  return raw === UNSCHEDULED_DAY;
}

/**
 * Whether a row is fully unscheduled: the day sentinel with both times zeroed.
 * Requiring the zeroed times means a day 0 row that still carries real times, a
 * meeting mislabeled to day 0, is not silently dropped but falls through to the
 * normal parse, which records a warning.
 */
export function isUnscheduledRow(
  teachDay: string,
  teachTime: string,
  teachTime2: string,
): boolean {
  return (
    teachDay === UNSCHEDULED_DAY &&
    teachTime === UNSCHEDULED_TIME &&
    teachTime2 === UNSCHEDULED_TIME
  );
}

/**
 * Convert a raw `teach_day` value to a `DayOfWeek`, or null when the value is
 * outside the documented 1 through 7 range so the caller can record a per row
 * warning rather than crash the whole result. The unscheduled sentinel 0 is one
 * such null; callers distinguish it with `isUnscheduledDay`.
 */
export function parseTeachDay(raw: string): DayOfWeek | null {
  return DAY_MAP.get(raw) ?? null;
}
