import { describe, expect, it } from 'vitest';
import {
  makePlanEntry,
  makeSection,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import { createTranslator } from '@/lib/i18n/t';
import type { PlanEntry } from '@/lib/domain/plan';
import type { Exam } from '@/lib/domain/types';
import { DEFAULT_DISPLAY_OPTIONS } from '@/lib/planner/displayOptions';
import { buildExamSchedule } from '@/lib/planner/examSchedule';
import { examScheduleLines } from './examScheduleLines';

const th = createTranslator('th');
const en = createTranslator('en');

function entry(
  teachTableId: string,
  subjectId: string,
  exam: Exam,
  section = '1',
): PlanEntry {
  return makePlanEntry({
    snapshot: makeSnapshot({
      ...makeSection({ teachTableId, subjectId, section, exam }),
      subjectMeta: {
        subjectId,
        nameTh: `วิชา ${subjectId}`,
        nameEn: `Subject ${subjectId}`,
        credit: 3,
        creditStr: '3(3-0-6)',
      },
    }),
  });
}

const PLAN = [
  entry('a', '90000002', {
    midterm: { start: '2026-12-14 13:30:00', end: '2026-12-14 16:30:00' },
    final: { start: '2027-02-20 09:00:00', end: '2027-02-20 12:00:00' },
  }),
  entry('b', '90000001', {
    midterm: { start: '2026-12-10 09:00:00', end: '2026-12-10 12:00:00' },
  }),
  entry('c', '90000003', {}, '901'),
];

describe('examScheduleLines', () => {
  it('lists midterms then finals in date order, then the subjects with no dated exam', () => {
    const lines = examScheduleLines(
      buildExamSchedule(PLAN),
      { ...DEFAULT_DISPLAY_OPTIONS, showEnglishNames: false },
      'th',
      th,
    );
    expect(lines.map((line) => [line.label, line.when, line.subject])).toEqual([
      ['กลางภาค', '10 ธ.ค. 2569 09:00-12:00', 'วิชา 90000001 (1)'],
      ['กลางภาค', '14 ธ.ค. 2569 13:30-16:30', 'วิชา 90000002 (1)'],
      ['ปลายภาค', '20 ก.พ. 2570 09:00-12:00', 'วิชา 90000002 (1)'],
      ['จัดสอบเอง', null, 'วิชา 90000003 (901)'],
    ]);
    expect(new Set(lines.map((line) => line.key)).size).toBe(lines.length);
  });

  it('names the subject through the same display options as the rest of the export', () => {
    const [first] = examScheduleLines(
      buildExamSchedule(PLAN),
      {
        ...DEFAULT_DISPLAY_OPTIONS,
        showSubjectId: true,
        showSection: false,
        showEnglishNames: true,
      },
      'th',
      th,
    );
    expect(first?.subject).toBe('90000001 วิชา 90000001 Subject 90000001');
  });

  it('reads the English labels and names in English', () => {
    const lines = examScheduleLines(
      buildExamSchedule(PLAN),
      DEFAULT_DISPLAY_OPTIONS,
      'en',
      en,
    );
    expect(lines[0]).toMatchObject({
      label: 'Midterm',
      subject: 'Subject 90000001 (1)',
    });
    expect(lines.at(-1)).toMatchObject({
      label: 'Arranged by instructor',
      when: null,
    });
  });

  it('lists a pair that shares a window once with both section codes', () => {
    const window = {
      midterm: { start: '2026-12-10 09:00:00', end: '2026-12-10 12:00:00' },
    };
    const lines = examScheduleLines(
      buildExamSchedule([
        entry('p1', '90000004', window, '2'),
        entry('p2', '90000004', window, '1'),
      ]),
      DEFAULT_DISPLAY_OPTIONS,
      'en',
      en,
    );
    expect(lines.map((line) => line.subject)).toEqual([
      'Subject 90000004 (1, 2)',
    ]);
  });

  it('has no lines for an empty plan', () => {
    expect(
      examScheduleLines(
        buildExamSchedule([]),
        DEFAULT_DISPLAY_OPTIONS,
        'th',
        th,
      ),
    ).toEqual([]);
  });
});
