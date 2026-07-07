// Zod schemas for every network trust boundary. They mirror the observed shape
// of the five endpoints, including the fields that are nullable, the grouping
// sentinels, and the count union. Schemas strip unknown keys, so a drifted server
// field passes the hard gate here and is surfaced separately by the contract
// auditor, which walks the raw response. Inferred Raw* types are the single
// source of truth for boundary shapes.

import { z } from 'zod';
import {
  ok,
  err,
  validationError,
  type Result,
  type ValidationError,
} from '../utils/result';

/** Validate untrusted data against a schema, returning a typed Result. */
export function validate<T>(
  schema: z.ZodType<T>,
  data: unknown,
): Result<T, ValidationError> {
  const parsed = schema.safeParse(data);
  if (parsed.success) {
    return ok(parsed.data);
  }
  const issues = parsed.error.issues.map((issue) => ({
    path: issue.path.map((segment) => String(segment)).join('.'),
    message: issue.message,
  }));
  return err(validationError(issues));
}

// Endpoint 4.2: faculty list. Acronym, prefix, and audit fields are nullable or
// empty in real data, and the acronym fields are swapped at the source.
export const facultySchema = z.object({
  FACULTY_ID: z.string(),
  OFFICIAL_FACULTY_ID: z.string().nullable(),
  PREFIX_NAME_TH: z.string(),
  PREFIX_NAME_EN: z.string(),
  FACULTY_NAME_TH: z.string(),
  FACULTY_NAME_EN: z.string(),
  ACRONYM_TH: z.string().nullable(),
  ACRONYM_EN: z.string().nullable(),
  MUA_FACULTY_ID: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});
export const facultyListSchema = z.array(facultySchema);

// Endpoint 4.3: department list. Four required strings, no nulls observed.
export const departmentSchema = z.object({
  faculty_id: z.string(),
  department_id: z.string(),
  department_name_th: z.string(),
  department_name_en: z.string(),
});
export const departmentListSchema = z.array(departmentSchema);

// Endpoint 4.4: curriculum list. Id widths vary and must not be zero padded;
// REGISTRAR_DEPARTMENT_ID can be empty; PERIOD can be null.
export const curriculumSchema = z.object({
  CURRICULUM_ID: z.string(),
  LEVEL_ID: z.string(),
  YEAR: z.string(),
  FACULTY_ID: z.string(),
  REGISTRAR_DEPARTMENT_ID: z.string(),
  REGISTRAR_CURRICULUM_ID: z.string(),
  REGISTRAR_CURRICULUM2_ID: z.string(),
  FULL_NAME_TH: z.string(),
  FULL_NAME_EN: z.string(),
  SHORT_NAME_TH: z.string(),
  SHORT_NAME_EN: z.string(),
  MUA_CURRICULUM_ID: z.string(),
  TCAS_PROGRAM_ID: z.string(),
  PERIOD: z.string().nullable(),
  INTER: z.string(),
  ACTIVE: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});
export const curriculumListSchema = z.array(curriculumSchema);

// Endpoint 4.5: subject owner groups. Three strings; the two name fields carry
// identical Thai text in real data.
export const subjectOwnerSchema = z.object({
  TEACH_TABLE_SUBJECT_OWNER_ID: z.string(),
  TEACH_TABLE_SUBJECT_OWNER_NAME_MAIN_PAGE_TH: z.string(),
  TEACH_TABLE_SUBJECT_OWNER_NAME_MAIN_PAGE_EN: z.string(),
});
export const subjectOwnerListSchema = z.array(subjectOwnerSchema);

export type RawFaculty = z.infer<typeof facultySchema>;
export type RawDepartment = z.infer<typeof departmentSchema>;
export type RawCurriculum = z.infer<typeof curriculumSchema>;
export type RawSubjectOwner = z.infer<typeof subjectOwnerSchema>;
