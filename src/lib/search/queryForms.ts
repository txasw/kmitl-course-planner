// The reverse of the query builders in formState: read a teach table query back into
// the search tab, the shared term, and the tab form that would build it. The host's
// #/teach_table result route carries the same params the API takes, so a student who
// arrives on a result page can find the same search prefilled in the panel. This only
// reads the host URL (Section 4.6) and never navigates or submits on the host.
//
// The mapping is strict. A shape the form cannot build, such as the retired by_class
// all faculties or all departments search (ADR-0031), a subject id that is not 8
// digits, or a term that is not a real one, yields null rather than a form that would
// search something other than what the route shows. Each search_all_* flag decides
// its select: when it is set, the paired sentinel value is not read, and when it is
// clear, the select must hold a concrete value rather than a sentinel.

import type { TeachTableQuery } from '../messaging/protocol';
import { sourceQueryToQuery } from '../planner/sourceQuery';
import { termFromQueryFields, type Term } from '../routing/academicTerms';
import type { TeachTableRoute } from '../routing/parseTeachTableRoute';
import {
  ALL_OPTION,
  asClassYear,
  isValidSubjectId,
  type CategoryForm,
  type ClassForm,
  type ClassYear,
  type SearchForms,
  type SubjectIdForm,
} from './formState';

/** The tab, term, and tab form a query maps back to. */
export type SearchPrefill =
  | { tab: 'by_class'; term: Term; form: ClassForm }
  | { tab: 'by_subject_id'; term: Term; form: SubjectIdForm }
  | { tab: 'by_subject_owner_id'; term: Term; form: CategoryForm };

type ByClassQuery = Extract<TeachTableQuery, { mode: 'by_class' }>;
type BySubjectIdQuery = Extract<TeachTableQuery, { mode: 'by_subject_id' }>;
type ByCategoryQuery = Extract<
  TeachTableQuery,
  { mode: 'by_subject_owner_id' }
>;

// The values that stand in for a concrete grouping select in an all search: the x the
// host sends and the form's own all option. The class year sentinel 0 is not one of
// them, since asClassYear already rejects it and a grouping id of 0 is a real id.
const GROUPING_SENTINELS = new Set(['x', ALL_OPTION]);

// A Buddhist year on the host is four digits, such as 2569.
const BUDDHIST_YEAR = /^\d{4}$/;

/** A concrete grouping select value: present and not one of the all sentinels. */
function isConcrete(value: string | undefined): value is string {
  return value !== undefined && value !== '' && !GROUPING_SENTINELS.has(value);
}

function readTerm(query: TeachTableQuery): Term | null {
  const term = termFromQueryFields(
    query.selected_year,
    query.selected_semester,
  );
  return term !== null && BUDDHIST_YEAR.test(term.year) ? term : null;
}

function classYearOf(query: ByClassQuery): ClassYear | null {
  if (query.search_all_class_year) {
    return ALL_OPTION;
  }
  const classYear = asClassYear(query.selected_class_year);
  return classYear === ALL_OPTION ? null : classYear;
}

function classForm(query: ByClassQuery): ClassForm | null {
  // The by_class form has no all faculties or all departments option (ADR-0031).
  if (query.search_all_faculty || query.search_all_department) {
    return null;
  }
  if (
    !isConcrete(query.selected_faculty) ||
    !isConcrete(query.selected_department)
  ) {
    return null;
  }
  const classYear = classYearOf(query);
  if (classYear === null) {
    return null;
  }
  if (!query.search_all_curriculum && !isConcrete(query.selected_curriculum)) {
    return null;
  }
  return {
    faculty: query.selected_faculty,
    department: query.selected_department,
    curriculum: query.search_all_curriculum
      ? ALL_OPTION
      : query.selected_curriculum,
    classYear,
  };
}

function subjectIdForm(query: BySubjectIdQuery): SubjectIdForm | null {
  // The host searches a subject id across everything, so every flag is set.
  const searchesAll =
    query.search_all_faculty &&
    query.search_all_department &&
    query.search_all_curriculum &&
    query.search_all_class_year;
  return searchesAll && isValidSubjectId(query.selected_subject_id)
    ? { subjectId: query.selected_subject_id }
    : null;
}

function categoryForm(query: ByCategoryQuery): CategoryForm | null {
  if (!isConcrete(query.selected_subject_owner_id)) {
    return null;
  }
  if (query.search_all_faculty) {
    return {
      faculty: ALL_OPTION,
      subjectOwner: query.selected_subject_owner_id,
    };
  }
  return isConcrete(query.selected_faculty)
    ? {
        faculty: query.selected_faculty,
        subjectOwner: query.selected_subject_owner_id,
      }
    : null;
}

/** The tab, term, and form that build the given query, or null when none can. */
export function formsFromQuery(query: TeachTableQuery): SearchPrefill | null {
  const term = readTerm(query);
  if (term === null) {
    return null;
  }
  switch (query.mode) {
    case 'by_class': {
      const form = classForm(query);
      return form === null ? null : { tab: query.mode, term, form };
    }
    case 'by_subject_id': {
      const form = subjectIdForm(query);
      return form === null ? null : { tab: query.mode, term, form };
    }
    case 'by_subject_owner_id': {
      const form = categoryForm(query);
      return form === null ? null : { tab: query.mode, term, form };
    }
  }
}

/**
 * The prefill a #/teach_table result route maps to, or null when its params do not
 * form a query the panel can search. The params pass the same Zod validated reading
 * a stored source query does, so params the query does not know are dropped.
 */
export function routeSearchPrefill(
  route: TeachTableRoute,
): SearchPrefill | null {
  const query = sourceQueryToQuery(route.params);
  return query === null ? null : formsFromQuery(query);
}

/** The forms with the prefilled tab's form in place and the other tabs kept. */
export function applyPrefillForms(
  prefill: SearchPrefill,
  forms: SearchForms,
): SearchForms {
  switch (prefill.tab) {
    case 'by_class':
      return { ...forms, byClass: prefill.form };
    case 'by_subject_id':
      return { ...forms, bySubjectId: prefill.form };
    case 'by_subject_owner_id':
      return { ...forms, byCategory: prefill.form };
  }
}
