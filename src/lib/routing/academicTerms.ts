// Academic year and semester options. No dedicated endpoint was captured for the
// year or semester lists, so they are generated locally: Buddhist years from 2560
// through the current Buddhist year plus one, and the three fixed semesters. The
// current year is injected rather than read from the clock so this module stays
// pure and testable, and so a future official endpoint can replace the generator
// behind the same shape. A tab opening without a persisted search seeds its term
// from the #/teach_table result route when present, otherwise the newest year.

import type { TeachTableRoute } from './parseTeachTableRoute';

export const SEMESTERS = ['1', '2', '3'] as const;
export type Semester = (typeof SEMESTERS)[number];

/** The first Buddhist year the generated list offers. */
export const EARLIEST_BUDDHIST_YEAR = 2560;

/** Convert a Gregorian year to its Thai Buddhist calendar year. */
export function toBuddhistYear(gregorianYear: number): number {
  return gregorianYear + 543;
}

/**
 * Buddhist years from EARLIEST_BUDDHIST_YEAR through the current Buddhist year
 * plus one, ascending. Callers pass the current Buddhist year explicitly.
 */
export function buddhistYears(currentBuddhistYear: number): string[] {
  const end = Math.max(currentBuddhistYear + 1, EARLIEST_BUDDHIST_YEAR);
  const years: string[] = [];
  for (let year = EARLIEST_BUDDHIST_YEAR; year <= end; year += 1) {
    years.push(String(year));
  }
  return years;
}

export interface Term {
  year: string;
  semester: Semester;
}

function coerceSemester(value: string | undefined): Semester | null {
  return value === '1' || value === '2' || value === '3' ? value : null;
}

/**
 * The term a tab opens on when there is no persisted search: the year and
 * semester carried by a #/teach_table result route when present and valid,
 * otherwise the newest generated year and the first semester.
 */
export function resolveInitialTerm(
  route: TeachTableRoute | null,
  years: string[],
): Term {
  const newest = years[years.length - 1] ?? String(EARLIEST_BUDDHIST_YEAR);
  const routeYear = route?.params.selected_year;
  const routeSemester = coerceSemester(route?.params.selected_semester);
  return {
    year: routeYear !== undefined && routeYear.length > 0 ? routeYear : newest,
    semester: routeSemester ?? '1',
  };
}
