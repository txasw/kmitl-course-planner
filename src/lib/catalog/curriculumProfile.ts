// The curriculum and class year a student studies in, which the open to my
// curriculum filter matches a section's offeredTo groupings against (ADR-0061). A
// profile names one real grouping, so it never holds an all value: not the x
// sentinel of the data, not the all option of the search form, and no class year 0.
// The ids keep the reference lists' own format, and a match compares them through
// idsEqual, so the width of a stored id never matters.

import { z } from 'zod';

const ANY_VALUES: readonly string[] = ['x', 'all'];

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
