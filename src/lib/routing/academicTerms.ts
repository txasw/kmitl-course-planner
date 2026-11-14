// Academic year and semester options. No endpoint lists the years or semesters,
// so they are generated locally: Buddhist years from 2560 through the current
// Buddhist year plus one, and the three fixed semesters. The current year is
// injected rather than read from the clock so this module stays pure and testable.
// The term the form opens on is resolved here from every source in precedence
// order, including the current term the registrar reports, which the caller fetches
// and passes in (ADR-0053).

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

/**
 * The year options with one more year merged in, ascending. A term can arrive from a
 * route or a stored search outside the generated span, and a select must still offer
 * the year it shows. An empty year adds nothing.
 */
export function yearsWith(years: readonly string[], year: string): string[] {
  if (year.length === 0 || years.includes(year)) {
    return [...years];
  }
  return [...years, year].sort((a, b) => Number(a) - Number(b));
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

/** A term as the semester over the year, for example 1/2569, the form both locales read. */
export function termText(term: Term): string {
  return `${term.semester}/${term.year}`;
}

/**
 * The term after the given one: semester 1 and 2 advance within the year, and
 * semester 3 rolls over to the first semester of the next year. Students plan the
 * registration ahead of them, so the term the registrar reports as current is not
 * the term they search.
 */
export function nextTerm(term: Term): Term {
  if (term.semester === '1') {
    return { year: term.year, semester: '2' };
  }
  if (term.semester === '2') {
    return { year: term.year, semester: '3' };
  }
  return { year: String(Number(term.year) + 1), semester: '1' };
}

/**
 * Narrow a semester string to the enum, or null when it is not one. There is no
 * default: a caller that silently read a missing semester as the first one would let
 * a malformed source query pass the cross term gate of a first semester plan.
 */
export function parseSemester(value: string | undefined): Semester | null {
  return SEMESTERS.find((semester) => semester === value) ?? null;
}

/** Where the resolved initial term came from, in precedence order. */
export type InitialTermSource =
  'route' | 'persisted' | 'plan' | 'registration' | 'fallback';

export interface InitialTermSources {
  /** The #/teach_table result route captured at mount, if any. */
  route: TeachTableRoute | null;
  /** The active tab term of the persisted last search, if any. */
  persisted: Term | null;
  /** The active plan's term, if a plan is active. */
  plan: Term | null;
  /** The term the registrar reports as current, or null until it answers. */
  current: Term | null;
  /** The generated year options, newest last. */
  years: string[];
}

export interface InitialTerm {
  term: Term;
  source: InitialTermSource;
}

/**
 * The term the search form opens on. A #/teach_table route carrying a valid year
 * and semester wins, then the persisted last search, then the active plan, then the
 * term after the registrar's current term, since students plan the coming
 * registration. With none of those, the newest generated year and the first
 * semester. The source is returned so the caller knows whether a later answer from
 * the registrar may still replace the result.
 */
export function resolveInitialTerm(sources: InitialTermSources): InitialTerm {
  const routeTerm = termFromQueryFields(
    sources.route?.params.selected_year,
    sources.route?.params.selected_semester,
  );
  if (routeTerm !== null) {
    return { term: routeTerm, source: 'route' };
  }
  if (sources.persisted !== null) {
    return { term: sources.persisted, source: 'persisted' };
  }
  if (sources.plan !== null) {
    return { term: sources.plan, source: 'plan' };
  }
  if (sources.current !== null) {
    return { term: nextTerm(sources.current), source: 'registration' };
  }
  const newest =
    sources.years[sources.years.length - 1] ?? String(EARLIEST_BUDDHIST_YEAR);
  return { term: { year: newest, semester: '1' }, source: 'fallback' };
}
