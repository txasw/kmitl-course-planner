// A synthetic dense catalog for the performance profiling spec. It is not a
// captured response. The real by_subject_id capture
// (tests/fixtures/teach-table.by_subject_id.capture.json) is 499 raw rows but
// dedupes to only 44 unique sections, so it never exercises the render path at the
// scale the Phase 8 acceptance names (a 500 section dataset, the 300 section
// virtualization threshold). This module fills that gap by multiplying one real row
// shape into hundreds of unique open sections, so the profiling run measures the
// catalog and drag at the acceptance scale. It lives under tests and never ships.
//
// Provenance: the template row is read verbatim from the real capture, so every one
// of its fields is a real value in a real shape. Only the identity and schedule
// fields are overridden per section (a unique teach_table_id and 8 digit subject id,
// a day and hour, an open seat count), which is why the generated payload passes the
// same Zod schema the live data does. The remark and teacher html are trimmed so the
// payload stays lean at 500 rows.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface TeachTableGroup {
  subject_type_name_th: string;
  subject_type_name_en: string;
  data: Record<string, unknown>[];
}

interface CurriculumGroup {
  teachtable: TeachTableGroup[];
  [key: string]: unknown;
}

const CAPTURE_PATH = resolve(
  process.cwd(),
  'tests/fixtures/teach-table.by_subject_id.capture.json',
);

/** The first non empty row of the real capture, cloned as the shape template. */
function templateRow(): Record<string, unknown> {
  const capture = JSON.parse(
    readFileSync(CAPTURE_PATH, 'utf8'),
  ) as CurriculumGroup[];
  for (const group of capture) {
    for (const table of group.teachtable) {
      const first = table.data[0];
      if (first !== undefined) {
        return first;
      }
    }
  }
  throw new Error('the real capture has no rows to template from');
}

/** The first grouping object of the real capture, its teachtable replaced below. */
function templateGroup(): CurriculumGroup {
  const capture = JSON.parse(
    readFileSync(CAPTURE_PATH, 'utf8'),
  ) as CurriculumGroup[];
  const first = capture[0];
  if (first === undefined) {
    throw new Error('the real capture has no grouping to template from');
  }
  return first;
}

const START_HOUR = 7;
const HOURS = 14; // 07:00 through 21:00 in one hour slots
const DAYS = ['2', '3', '4', '5', '6']; // Monday through Friday

/** Count of mutually non conflicting slots: the first this many single courses sit
 * in distinct day and hour cells, so a spec can build a dense conflict free plan. */
export const NON_CONFLICTING_SLOTS = DAYS.length * HOURS;

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

/** Spread section index i across day and hour so the first SLOTS indices are all
 * mutually non conflicting, which lets the profiling spec build a dense plan. */
function slotFor(i: number): { day: string; start: string; end: string } {
  const day = DAYS[i % DAYS.length] ?? '2';
  const hour = START_HOUR + (Math.floor(i / DAYS.length) % HOURS);
  return { day, start: `${pad(hour)}:00:00`, end: `${pad(hour + 1)}:00:00` };
}

function row(
  base: Record<string, unknown>,
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...base,
    sec_pair: null,
    lect_or_prac: 'ท',
    teachtime_str: '',
    midterm_start_date_time: null,
    midterm_end_date_time: null,
    final_start_date_time: null,
    final_end_date_time: null,
    exam_text_detail: null,
    rules_th: '',
    rules_en: '',
    remark: '',
    teacher_list_th: '<div>อ. ทดสอบ</div>',
    teacher_list_en: '<div>Test Lecturer</div>',
    closed: '0',
    limit: '84',
    pre_count: 0,
    queue_left: 10,
    count: 10,
    ...overrides,
  };
}

export interface DenseCatalogOptions {
  /** Single section courses that make up the catalog bulk. */
  singleCount?: number;
  /** Sections on one fat course, the course drag stressor. Each drag paints them
   * all as candidates, so sweeping the pointer re-renders the grid once per hover. */
  fatCount?: number;
}

/** The reserved fat course subject id, a course with many sections. */
export const FAT_COURSE_ID = '80009000';

/** The subject id of the nth single section course, zero based. */
export function denseSubjectId(i: number): string {
  return (80000000 + i).toString();
}

/**
 * Build a teach table response of `singleCount` single section courses plus one fat
 * course, all open and addable. The first NON_CONFLICTING_SLOTS single courses sit in
 * unique non conflicting slots, so a spec can add a dense plan from them.
 */
export function denseCatalog(options: DenseCatalogOptions = {}): unknown {
  const singleCount = options.singleCount ?? 500;
  const fatCount = options.fatCount ?? 36;
  const base = templateRow();
  const group = templateGroup();

  const data: Record<string, unknown>[] = [];
  for (let i = 0; i < singleCount; i++) {
    const slot = slotFor(i);
    data.push(
      row(base, {
        teach_table_id: (700000 + i).toString(),
        subject_id: denseSubjectId(i),
        subject_name_th: `วิชาทดสอบ ${i.toString()}`,
        subject_name_en: `TEST COURSE ${i.toString()}`,
        section: '101',
        teach_day: slot.day,
        teach_time: slot.start,
        teach_time2: slot.end,
      }),
    );
  }
  for (let j = 0; j < fatCount; j++) {
    const slot = slotFor(j);
    data.push(
      row(base, {
        teach_table_id: (790000 + j).toString(),
        subject_id: FAT_COURSE_ID,
        subject_name_th: 'วิชาหลายกลุ่ม',
        subject_name_en: 'MANY SECTION COURSE',
        section: (900 + j).toString(),
        teach_day: slot.day,
        teach_time: slot.start,
        teach_time2: slot.end,
      }),
    );
  }

  return [
    {
      ...group,
      teachtable: [
        {
          subject_type_name_th: 'กลุ่ม 1 (วิชา GenEd / วิชาเลือกเสรี)',
          subject_type_name_en:
            'Group 1 (General Education / Elective Subject)',
          data,
        },
      ],
    },
  ];
}

/** The dense catalog serialized, ready for the mock server response body. */
export function denseCatalogJson(options: DenseCatalogOptions = {}): string {
  return JSON.stringify(denseCatalog(options));
}
