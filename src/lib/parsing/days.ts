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
 * Convert a raw `teach_day` value to a `DayOfWeek`, or null when the value is
 * outside the documented 1 through 7 range so the caller can record a per row
 * warning rather than crash the whole result.
 */
export function parseTeachDay(raw: string): DayOfWeek | null {
  return DAY_MAP.get(raw) ?? null;
}
