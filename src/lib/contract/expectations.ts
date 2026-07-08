// The field expectation table: the single source of truth for the contract
// auditor, its tests, and the field notes in Section 4.1. It encodes, per field,
// the presence, type, nullability, format pattern, and enum values the observed
// contract carries, plus the cross field rules a single row cannot express. The
// auditor walks raw rows against this table, so contract knowledge never forks.
//
// This module ships only in debug builds and tests, and embeds a canary the
// production bundle check greps for.

import { parseTimeToMinutes } from '../parsing/time';

export const DEBUG_CANARY = 'kcp-debug-canary';

export type ExpectationKind = 'string' | 'number' | 'count';

export interface FieldExpectation {
  readonly field: string;
  readonly kind: ExpectationKind;
  readonly nullable: boolean;
  /** A format the non null string value must match; a miss is a format_violation. */
  readonly pattern?: RegExp;
  /** The exact allowed string values; a miss is a value_out_of_range. */
  readonly enum?: readonly string[];
  readonly description: string;
}

interface FieldOptions {
  pattern?: RegExp;
  enum?: readonly string[];
}

function field(
  name: string,
  kind: ExpectationKind,
  nullable: boolean,
  description: string,
  options: FieldOptions = {},
): FieldExpectation {
  return { field: name, kind, nullable, description, ...options };
}

const HHMMSS = /^\d{2}:\d{2}:\d{2}$/;
const DAY_VALUES = ['1', '2', '3', '4', '5', '6', '7'] as const;

/** The full contract for one teach table section row (Section 4.1). */
export const SECTION_ROW_EXPECTATIONS: readonly FieldExpectation[] = [
  field('teach_table_id', 'string', false, 'unique section id'),
  field('subject_id', 'string', false, '8 digit subject code', {
    pattern: /^\d{8}$/,
  }),
  field('subject_name_th', 'string', false, 'Thai subject name'),
  field('subject_name_en', 'string', false, 'English subject name'),
  field('credit', 'string', false, 'numeric credit string', {
    pattern: /^\d+$/,
  }),
  field('credit_lps', 'string', false, 'lecture practice self study string'),
  field('credit_str', 'string', false, 'combined credit string'),
  field('section', 'string', false, 'section code'),
  field('sec_pair', 'string', true, 'paired section code or null'),
  field('lect_or_prac', 'string', false, 'lecture or practice marker', {
    enum: ['ท', 'ป'],
  }),
  field('teach_day', 'string', false, 'day digit 1 through 7', {
    enum: DAY_VALUES,
  }),
  field('teach_time', 'string', false, 'HH:MM:SS start time', {
    pattern: HHMMSS,
  }),
  field('teach_time2', 'string', false, 'HH:MM:SS end time', {
    pattern: HHMMSS,
  }),
  field(
    'teachtime_str',
    'string',
    true,
    'display time string, often empty or null on unscheduled rows',
  ),
  field('classroom', 'string', true, 'room name or null'),
  field('room_no', 'string', true, 'room number or null'),
  field('classbuilding', 'string', true, 'building name or null'),
  field('building_no', 'string', true, 'building number or null'),
  field('teacher_list_th', 'string', false, 'Thai teacher HTML fragment'),
  field('teacher_list_en', 'string', false, 'English teacher HTML fragment'),
  field('midterm_start_date_time', 'string', true, 'midterm start or null'),
  field('midterm_end_date_time', 'string', true, 'midterm end or null'),
  field('final_start_date_time', 'string', true, 'final start or null'),
  field('final_end_date_time', 'string', true, 'final end or null'),
  field('exam_text_detail', 'string', true, 'exam detail or null'),
  field('rules_th', 'string', false, 'Thai rules text'),
  field('rules_en', 'string', false, 'English rules text'),
  field('remark', 'string', false, 'free text remark'),
  field('closed', 'string', false, 'open or closed flag', { enum: ['0', '1'] }),
  field('limit', 'string', false, 'seat capacity string or dash'),
  field('pre_count', 'number', false, 'pre registered count'),
  field('queue_left', 'number', false, 'remaining queue slots'),
  field('count', 'count', false, 'enrolled number or the full marker'),
  field('class_group_display', 'number', false, 'class group display value'),
];

export const SECTION_ROW_FIELDS: ReadonlySet<string> = new Set(
  SECTION_ROW_EXPECTATIONS.map((expectation) => expectation.field),
);

/** Minimal presence and type expectations for the reference endpoints. */
export const FACULTY_EXPECTATIONS: readonly FieldExpectation[] = [
  field('FACULTY_ID', 'string', false, 'faculty id'),
  field('FACULTY_NAME_TH', 'string', false, 'Thai faculty name'),
  field('FACULTY_NAME_EN', 'string', false, 'English faculty name'),
  field('ACRONYM_TH', 'string', true, 'Thai acronym or null'),
  field('ACRONYM_EN', 'string', true, 'English acronym or null'),
];

export const DEPARTMENT_EXPECTATIONS: readonly FieldExpectation[] = [
  field('faculty_id', 'string', false, 'faculty id'),
  field('department_id', 'string', false, 'department id'),
  field('department_name_th', 'string', false, 'Thai department name'),
  field('department_name_en', 'string', false, 'English department name'),
];

export const CURRICULUM_EXPECTATIONS: readonly FieldExpectation[] = [
  field('FACULTY_ID', 'string', false, 'faculty id'),
  field(
    'REGISTRAR_DEPARTMENT_ID',
    'string',
    false,
    'department id, may be empty',
  ),
  field(
    'REGISTRAR_CURRICULUM2_ID',
    'string',
    false,
    'curriculum id, variable width',
  ),
  field('ACTIVE', 'string', false, 'active flag'),
  field('PERIOD', 'string', true, 'period or null'),
];

export const SUBJECT_OWNER_EXPECTATIONS: readonly FieldExpectation[] = [
  field('TEACH_TABLE_SUBJECT_OWNER_ID', 'string', false, 'owner id'),
  field(
    'TEACH_TABLE_SUBJECT_OWNER_NAME_MAIN_PAGE_TH',
    'string',
    false,
    'Thai owner name',
  ),
  field(
    'TEACH_TABLE_SUBJECT_OWNER_NAME_MAIN_PAGE_EN',
    'string',
    false,
    'English owner name',
  ),
];

/** A rule spanning more than one field. `check` returns the offending value
 *  description when violated, or null when the row satisfies the rule. */
export interface CrossFieldRule {
  readonly id: string;
  readonly field: string;
  readonly description: string;
  check(
    row: Record<string, unknown>,
    allRows: Record<string, unknown>[],
  ): string | null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export const CROSS_FIELD_RULES: readonly CrossFieldRule[] = [
  {
    id: 'end_after_start',
    field: 'teach_time2',
    description: 'end time is after start time',
    check(row) {
      const start = asString(row.teach_time);
      const end = asString(row.teach_time2);
      if (start === null || end === null) {
        return null;
      }
      const startMin = parseTimeToMinutes(start);
      const endMin = parseTimeToMinutes(end);
      if (startMin === null || endMin === null) {
        return null;
      }
      return endMin > startMin ? null : `${start} to ${end}`;
    },
  },
  {
    id: 'sec_pair_resolves',
    field: 'sec_pair',
    description: 'sec_pair resolves to a section of the same subject',
    check(row, allRows) {
      const pair = asString(row.sec_pair);
      const subjectId = asString(row.subject_id);
      if (pair === null || pair.length === 0) {
        return null;
      }
      const resolved = allRows.some(
        (other) => other.section === pair && other.subject_id === subjectId,
      );
      return resolved ? null : `sec_pair "${pair}" has no matching section`;
    },
  },
];
