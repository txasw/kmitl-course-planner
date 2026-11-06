// The curriculum and class year a student studies in, which the open to my
// curriculum filter matches a section's offeredTo groupings against (ADR-0061). A
// profile names one real grouping, so it never holds an all value: not the x
// sentinel of the data, not the all option of the search form, and no class year 0.
// The ids keep the reference lists' own format, and a match compares them through
// idsEqual, so the width of a stored id never matters.

import { z } from 'zod';
import {
  ALL_OPTION,
  asClassYear,
  type ClassForm,
  type ClassYear,
} from '../search/formState';

const ANY_VALUES: readonly string[] = ['x', ALL_OPTION];

const groupingId = z
  .string()
  .min(1)
  .refine((id) => !ANY_VALUES.includes(id));

export const curriculumProfileSchema = z.object({
  facultyId: groupingId,
  departmentId: groupingId,
  curriculumId: groupingId,
  classYear: z.string().regex(/^[1-8]$/),
});
export type CurriculumProfile = z.infer<typeof curriculumProfileSchema>;

/** The four selects of a curriculum grouping; an empty class year means none yet. */
export interface CurriculumSelection {
  faculty: string;
  department: string;
  curriculum: string;
  classYear: ClassYear | '';
}

/**
 * The selection the profile picker opens with: the saved profile when there is one,
 * otherwise the class search form, which holds the last class search, with its all
 * curricula and all class years options cleared, since a profile cannot hold them.
 */
export function profileDraft(
  profile: CurriculumProfile | null,
  classForm: ClassForm,
): CurriculumSelection {
  if (profile !== null) {
    return {
      faculty: profile.facultyId,
      department: profile.departmentId,
      curriculum: profile.curriculumId,
      classYear: asClassYear(profile.classYear) ?? '',
    };
  }
  return {
    faculty: classForm.faculty,
    department: classForm.department,
    curriculum: classForm.curriculum === ALL_OPTION ? '' : classForm.curriculum,
    classYear: classForm.classYear === ALL_OPTION ? '' : classForm.classYear,
  };
}

/** The profile a complete selection names, or null while a select is still empty. */
export function profileFromSelection(
  selection: CurriculumSelection,
): CurriculumProfile | null {
  const parsed = curriculumProfileSchema.safeParse({
    facultyId: selection.faculty,
    departmentId: selection.department,
    curriculumId: selection.curriculum,
    classYear: selection.classYear,
  });
  return parsed.success ? parsed.data : null;
}
