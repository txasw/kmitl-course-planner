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

export const subjectIdFormSchema = classFormSchema.extend({
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
  return { ...defaultClassForm(term), subjectId: '' };
}

export function defaultCategoryForm(term: Term): CategoryForm {
  return {
    year: term.year,
    semester: term.semester,
    faculty: '',
    subjectOwner: '',
  };
}

/** A subject id is 1 to 8 digits, matching the 8 digit course code prefix. */
export function isValidSubjectId(value: string): boolean {
  return /^\d{1,8}$/.test(value);
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
    form.faculty !== '' && form.department !== '' && form.curriculum !== ''
  );
}

export function isSubjectIdFormReady(form: SubjectIdForm): boolean {
  return isClassFormReady(form) && isValidSubjectId(form.subjectId);
}

export function isCategoryFormReady(form: CategoryForm): boolean {
  return form.faculty !== '' && form.subjectOwner !== '';
}

function classParams(form: ClassForm) {
  const searchAllClassYear = form.classYear === 'all';
  return {
    selected_year: form.year,
    selected_semester: form.semester,
    selected_faculty: form.faculty,
    selected_department: form.department,
    selected_curriculum: form.curriculum,
    // With search_all_class_year set the specific value is ignored upstream, so
    // it is sent empty rather than a misleading year. Verify against live traffic.
    selected_class_year: searchAllClassYear ? '' : form.classYear,
    search_all_faculty: false,
    search_all_department: false,
    search_all_curriculum: false,
    search_all_class_year: searchAllClassYear,
  };
}

export function buildClassQuery(form: ClassForm): TeachTableQuery {
  return { mode: 'by_class', ...classParams(form) };
}

export function buildSubjectIdQuery(form: SubjectIdForm): TeachTableQuery {
  return {
    mode: 'by_subject_id',
    ...classParams(form),
    selected_subject_id: form.subjectId,
  };
}

export function buildCategoryQuery(form: CategoryForm): TeachTableQuery {
  return {
    mode: 'by_subject_owner_id',
    selected_year: form.year,
    selected_semester: form.semester,
    selected_faculty: form.faculty,
    search_all_faculty: false,
    selected_subject_owner_id: form.subjectOwner,
  };
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
