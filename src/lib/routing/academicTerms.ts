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

/**
 * Read a term from a query's year and semester strings, or null when either is
 * missing or the semester is not one of the three. Queries, stored source queries
 * and the catalog's browsed term all read their term through this one function.
 */
export function termFromQueryFields(
  year: string | undefined,
  semester: string | undefined,
): Term | null {
  const parsed = parseSemester(semester);
  if (year === undefined || year.length === 0 || parsed === null) {
    return null;
  }
  return { year, semester: parsed };
}

/** Two terms are equal when their year and semester both match. */
export function termsEqual(a: Term, b: Term): boolean {
  return a.year === b.year && a.semester === b.semester;
}

/**
 * Narrow a semester string to the enum, or null when it is not one. There is no
 * default: a caller that silently read a missing semester as the first one would let
 * a malformed source query pass the cross term gate of a first semester plan.
 */
export function parseSemester(value: string | undefined): Semester | null {
  return SEMESTERS.find((semester) => semester === value) ?? null;
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
  const routeSemester = parseSemester(route?.params.selected_semester);
  return {
    year: routeYear !== undefined && routeYear.length > 0 ? routeYear : newest,
    semester: routeSemester ?? '1',
  };
}
