// The pure form model behind the three search tabs. The term (year and semester) is
// one value shared by every tab, so switching tabs never changes the term a search
// targets; each tab holds only its own fields. Every shape is validated by a Zod
// schema, so the same shapes persist to storage and build the typed gateway query.
// The query builders are the single mapping from the term and the user facing form
// state to the wire parameters, including the class year "all" option that sets the
// search_all_class_year flag.

import { z } from 'zod';
import type { TeachTableQuery } from '../messaging/protocol';
import { SEMESTERS, type Semester, type Term } from '../routing/academicTerms';

export const SEARCH_TABS = [
  'by_class',
  'by_subject_id',
  'by_subject_owner_id',
] as const;
export type SearchTab = (typeof SEARCH_TABS)[number];

/** Class years 1 through 8, plus the "all" option that searches every year. */
export const CLASS_YEARS = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  'all',
] as const;
export type ClassYear = (typeof CLASS_YEARS)[number];

/** The term every search tab shares. An empty year means it is not seeded yet. */
export const searchTermSchema = z.object({
  year: z.string(),
  semester: z.enum(SEMESTERS),
});

export const classFormSchema = z.object({
  faculty: z.string(),
  department: z.string(),
  curriculum: z.string(),
  classYear: z.enum(CLASS_YEARS),
});
export type ClassForm = z.infer<typeof classFormSchema>;

// The host searches a subject id across every faculty, department, curriculum,
// and class year, so this tab needs only the shared term and the subject id.
export const subjectIdFormSchema = z.object({
  subjectId: z.string(),
});
export type SubjectIdForm = z.infer<typeof subjectIdFormSchema>;

export const categoryFormSchema = z.object({
  faculty: z.string(),
  subjectOwner: z.string(),
});
export type CategoryForm = z.infer<typeof categoryFormSchema>;

export function defaultClassForm(): ClassForm {
  return { faculty: '', department: '', curriculum: '', classYear: 'all' };
}

export function defaultSubjectIdForm(): SubjectIdForm {
  return { subjectId: '' };
}

export function defaultCategoryForm(): CategoryForm {
  return { faculty: '', subjectOwner: '' };
}

/** A subject id is exactly 8 digits, matching the course code. The live server
 * rejects any other length ("length is not equal 8"), so the client gate never
 * issues a query for a shorter or longer value. */
export function isValidSubjectId(value: string): boolean {
  return /^\d{8}$/.test(value);
}

/** Normalize raw subject id input: keep digits only and clamp to the 8 digit course code
 * prefix. Leading zeros survive because the field stays a text input. */
export function sanitizeSubjectId(value: string): string {
  return value.replace(/\D/g, '').slice(0, 8);
}

/** Narrow an arbitrary string to a class year option, or null otherwise. */
export function asClassYear(value: string): ClassYear | null {
  return CLASS_YEARS.find((classYear) => classYear === value) ?? null;
}

/** A term is ready once its year is seeded; the semester always holds a value. */
export function isTermReady(term: Term): boolean {
  return term.year !== '';
}

/**
 * A field the active tab still needs before it can search. A blocked submit names
 * the first one, in the order the fields appear, so the student knows what to fill.
 * The shared term row sits above every tab, so its year comes first.
 */
export type SearchField =
  | 'year'
  | 'faculty'
  | 'department'
  | 'curriculum'
  | 'subjectId'
  | 'subjectOwner';

/** The first field the class tab still needs, or null when it can search. */
export function missingClassField(form: ClassForm): SearchField | null {
  if (form.faculty === '') return 'faculty';
  if (form.department === '') return 'department';
  if (form.curriculum === '') return 'curriculum';
  return null;
}

/** The first field the subject id tab still needs, or null when it can search. */
export function missingSubjectIdField(form: SubjectIdForm): SearchField | null {
  return isValidSubjectId(form.subjectId) ? null : 'subjectId';
}

/** The first field the category tab still needs, or null when it can search. */
export function missingCategoryField(form: CategoryForm): SearchField | null {
  if (form.faculty === '') return 'faculty';
  if (form.subjectOwner === '') return 'subjectOwner';
  return null;
}

export function isClassFormReady(form: ClassForm): boolean {
  return missingClassField(form) === null;
}

export function isSubjectIdFormReady(form: SubjectIdForm): boolean {
  return missingSubjectIdField(form) === null;
}

export function isCategoryFormReady(form: CategoryForm): boolean {
  return missingCategoryField(form) === null;
}

/** The literal value a select carries when its "all" option is chosen. */
export const ALL_OPTION = 'all';

function classParams(term: Term, form: ClassForm) {
  const searchAllClassYear = form.classYear === ALL_OPTION;
  const searchAllCurriculum = form.curriculum === ALL_OPTION;
  return {
    selected_year: term.year,
    selected_semester: term.semester,
    selected_faculty: form.faculty,
    selected_department: form.department,
    // The host sends the x sentinel with search_all_curriculum for all curricula.
    selected_curriculum: searchAllCurriculum ? 'x' : form.curriculum,
    // The host sends class year 0 with search_all_class_year for the all option;
    // an empty value is rejected as "not integer". Verified against host traffic.
    selected_class_year: searchAllClassYear ? '0' : form.classYear,
    search_all_faculty: false,
    search_all_department: false,
    search_all_curriculum: searchAllCurriculum,
    search_all_class_year: searchAllClassYear,
  };
}

export function buildClassQuery(term: Term, form: ClassForm): TeachTableQuery {
  return { mode: 'by_class', ...classParams(term, form) };
}

export function buildSubjectIdQuery(
  term: Term,
  form: SubjectIdForm,
): TeachTableQuery {
  return {
    mode: 'by_subject_id',
    selected_year: term.year,
    selected_semester: term.semester,
    search_all_faculty: true,
    search_all_department: true,
    search_all_curriculum: true,
    search_all_class_year: true,
    selected_subject_id: form.subjectId,
  };
}

export function buildCategoryQuery(
  term: Term,
  form: CategoryForm,
): TeachTableQuery {
  const searchAllFaculty = form.faculty === ALL_OPTION;
  const base = {
    mode: 'by_subject_owner_id' as const,
    selected_year: term.year,
    selected_semester: term.semester,
    search_all_faculty: searchAllFaculty,
    selected_subject_owner_id: form.subjectOwner,
  };
  // The host omits selected_faculty for an all faculties search.
  return searchAllFaculty ? base : { ...base, selected_faculty: form.faculty };
}

export interface SearchForms {
  byClass: ClassForm;
  bySubjectId: SubjectIdForm;
  byCategory: CategoryForm;
}

/**
 * Build the gateway query for the active tab under the shared term, or null when
 * the term is not seeded or that tab's form is not ready to submit. This is the
 * single dispatch from tab to query.
 */
export function buildTeachTableQueryForTab(
  tab: SearchTab,
  term: Term,
  forms: SearchForms,
): TeachTableQuery | null {
  if (!isTermReady(term)) {
    return null;
  }
  switch (tab) {
    case 'by_class':
      return isClassFormReady(forms.byClass)
        ? buildClassQuery(term, forms.byClass)
        : null;
    case 'by_subject_id':
      return isSubjectIdFormReady(forms.bySubjectId)
        ? buildSubjectIdQuery(term, forms.bySubjectId)
        : null;
    case 'by_subject_owner_id':
      return isCategoryFormReady(forms.byCategory)
        ? buildCategoryQuery(term, forms.byCategory)
        : null;
  }
}

/** The first field the given tab still needs, or null when its form can search. */
export function missingField(
  tab: SearchTab,
  term: Term,
  forms: SearchForms,
): SearchField | null {
  if (!isTermReady(term)) return 'year';
  switch (tab) {
    case 'by_class':
      return missingClassField(forms.byClass);
    case 'by_subject_id':
      return missingSubjectIdField(forms.bySubjectId);
    case 'by_subject_owner_id':
      return missingCategoryField(forms.byCategory);
  }
}

export type { Semester };

/**
 * The forms with the given tab's fields back at their defaults. The term is not part
 * of a tab form: it is shared by every tab and seeded from the registrar, so clearing a
 * search never leaves the student to pick the year and semester again.
 */
export function clearTabForm(tab: SearchTab, forms: SearchForms): SearchForms {
  switch (tab) {
    case 'by_class':
      return { ...forms, byClass: defaultClassForm() };
    case 'by_subject_id':
      return { ...forms, bySubjectId: defaultSubjectIdForm() };
    case 'by_subject_owner_id':
      return { ...forms, byCategory: defaultCategoryForm() };
  }
}
