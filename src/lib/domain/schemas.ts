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

/** The exact string the API sends for `count` when a section is full. */
export const FULL_MARKER = 'เต็ม/Full';

// Endpoint 4.1: one section meeting row. Rooms and buildings and every exam
// field are nullable; `sec_pair` is nullable; `count` is a number when seats
// remain and the full marker string otherwise. `limit` stays a string because it
// carries the literal "-" for uncapped sections.
export const sectionRowSchema = z.object({
  teach_table_id: z.string(),
  subject_id: z.string(),
  subject_name_th: z.string(),
  subject_name_en: z.string(),
  credit: z.string(),
  credit_lps: z.string(),
  credit_str: z.string(),
  section: z.string(),
  sec_pair: z.string().nullable(),
  lect_or_prac: z.string(),
  teach_day: z.string(),
  teach_time: z.string(),
  teach_time2: z.string(),
  // Null on unscheduled online courses, which the all curricula query surfaces.
  teachtime_str: z.string().nullable(),
  classroom: z.string().nullable(),
  room_no: z.string().nullable(),
  classbuilding: z.string().nullable(),
  building_no: z.string().nullable(),
  teacher_list_th: z.string(),
  teacher_list_en: z.string(),
  midterm_start_date_time: z.string().nullable(),
  midterm_end_date_time: z.string().nullable(),
  final_start_date_time: z.string().nullable(),
  final_end_date_time: z.string().nullable(),
  exam_text_detail: z.string().nullable(),
  rules_th: z.string(),
  rules_en: z.string(),
  remark: z.string(),
  closed: z.string(),
  limit: z.string(),
  pre_count: z.number(),
  queue_left: z.number(),
  count: z.union([z.number(), z.literal(FULL_MARKER)]),
  class_group_display: z.number(),
});

// One subject type block ("กลุ่ม 1" or "กลุ่ม 2") within a grouping. `data` may be
// empty.
export const teachtableBlockSchema = z.object({
  subject_type_name_th: z.string(),
  subject_type_name_en: z.string(),
  data: z.array(sectionRowSchema),
});

// One curriculum grouping object. `department_id` and `curriculum2_id` admit the
// literal "x" sentinel, and the department and curriculum names are nullable on
// the catch all groupings.
export const groupingSchema = z.object({
  faculty_id: z.string(),
  department_id: z.string(),
  curriculum2_id: z.string(),
  class: z.string(),
  faculty_name_th: z.string(),
  faculty_name_en: z.string(),
  department_name_th: z.string().nullable(),
  department_name_en: z.string().nullable(),
  curriculum_name_th: z.string().nullable(),
  curriculum_name_en: z.string().nullable(),
  teachtable: z.array(teachtableBlockSchema),
});

export const teachTableResponseSchema = z.array(groupingSchema);

export type RawSectionRow = z.infer<typeof sectionRowSchema>;
export type RawTeachtableBlock = z.infer<typeof teachtableBlockSchema>;
export type RawGrouping = z.infer<typeof groupingSchema>;
export type RawTeachTableResponse = z.infer<typeof teachTableResponseSchema>;
