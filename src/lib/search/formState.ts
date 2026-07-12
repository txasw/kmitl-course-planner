// The pure form model behind the three search tabs. Each tab holds plain field
// values validated by a Zod schema, so the same shapes persist to storage and
// build the typed gateway query. The query builders are the single mapping from
// user facing form state to the wire parameters, including the class year "all"
// option that sets the search_all_class_year flag.

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

const semesterSchema = z.enum(['1', '2', '3']);

export const classFormSchema = z.object({
  year: z.string(),
  semester: semesterSchema,
  faculty: z.string(),
  department: z.string(),
  curriculum: z.string(),
  classYear: z.enum(CLASS_YEARS),
});
export type ClassForm = z.infer<typeof classFormSchema>;

// The host searches a subject id across every faculty, department, curriculum,
// and class year, so this tab needs only the term and the subject id.
export const subjectIdFormSchema = z.object({
  year: z.string(),
  semester: semesterSchema,
  subjectId: z.string(),
});
export type SubjectIdForm = z.infer<typeof subjectIdFormSchema>;

export const categoryFormSchema = z.object({
  year: z.string(),
  semester: semesterSchema,
  faculty: z.string(),
  subjectOwner: z.string(),
});
export type CategoryForm = z.infer<typeof categoryFormSchema>;

export function defaultClassForm(term: Term): ClassForm {
  return {
    year: term.year,
    semester: term.semester,
    faculty: '',
    department: '',
    curriculum: '',
    classYear: 'all',
  };
}

export function defaultSubjectIdForm(term: Term): SubjectIdForm {
  return { year: term.year, semester: term.semester, subjectId: '' };
}

export function defaultCategoryForm(term: Term): CategoryForm {
  return {
    year: term.year,
    semester: term.semester,
    faculty: '',
    subjectOwner: '',
  };
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

/** Narrow an arbitrary string to a semester, or null when it is not one. */
export function asSemester(value: string): Semester | null {
  return SEMESTERS.find((semester) => semester === value) ?? null;
}

/** Narrow an arbitrary string to a class year option, or null otherwise. */
export function asClassYear(value: string): ClassYear | null {
  return CLASS_YEARS.find((classYear) => classYear === value) ?? null;
}

export function isClassFormReady(form: ClassForm): boolean {
  return (
    form.year !== '' &&
    form.faculty !== '' &&
    form.department !== '' &&
    form.curriculum !== ''
  );
}

export function isSubjectIdFormReady(form: SubjectIdForm): boolean {
  return form.year !== '' && isValidSubjectId(form.subjectId);
}

export function isCategoryFormReady(form: CategoryForm): boolean {
  return form.year !== '' && form.faculty !== '' && form.subjectOwner !== '';
}

/** The literal value a select carries when its "all" option is chosen. */
export const ALL_OPTION = 'all';

function classParams(form: ClassForm) {
  const searchAllClassYear = form.classYear === ALL_OPTION;
  const searchAllCurriculum = form.curriculum === ALL_OPTION;
  return {
    selected_year: form.year,
    selected_semester: form.semester,
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

export function buildClassQuery(form: ClassForm): TeachTableQuery {
  return { mode: 'by_class', ...classParams(form) };
}

export function buildSubjectIdQuery(form: SubjectIdForm): TeachTableQuery {
  return {
    mode: 'by_subject_id',
    selected_year: form.year,
    selected_semester: form.semester,
    search_all_faculty: true,
    search_all_department: true,
    search_all_curriculum: true,
    search_all_class_year: true,
    selected_subject_id: form.subjectId,
  };
}

export function buildCategoryQuery(form: CategoryForm): TeachTableQuery {
  const searchAllFaculty = form.faculty === ALL_OPTION;
  const base = {
    mode: 'by_subject_owner_id' as const,
    selected_year: form.year,
    selected_semester: form.semester,
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
 * Build the gateway query for the active tab, or null when that tab's form is
 * not ready to submit. This is the single dispatch from tab to query.
 */
export function buildTeachTableQueryForTab(
  tab: SearchTab,
  forms: SearchForms,
): TeachTableQuery | null {
  switch (tab) {
    case 'by_class':
      return isClassFormReady(forms.byClass)
        ? buildClassQuery(forms.byClass)
        : null;
    case 'by_subject_id':
      return isSubjectIdFormReady(forms.bySubjectId)
        ? buildSubjectIdQuery(forms.bySubjectId)
        : null;
    case 'by_subject_owner_id':
      return isCategoryFormReady(forms.byCategory)
        ? buildCategoryQuery(forms.byCategory)
        : null;
  }
}

export type { Semester };
