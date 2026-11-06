import { describe, expect, it } from 'vitest';
import { loadFixture } from '../../../tests/support/fixtures';
import {
  makePlanEntry,
  makeSection,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import { buildSnapshot, type PlanEntry } from '../domain/plan';
import { normalizeTeachTable } from '../domain/normalize';
import type { Exam } from '../domain/types';
import { buildExamSchedule } from './examSchedule';

const FIXTURE = 'teach-table.with-exams.capture.json';

function captureEntry(teachTableId: string): PlanEntry {
  const result = normalizeTeachTable(loadFixture(FIXTURE));
  if (!result.ok) {
    throw new Error(`fixture ${FIXTURE} failed to normalize`);
  }
  for (const course of result.value.courses) {
    const section = course.sections.find(
      (candidate) => candidate.teachTableId === teachTableId,
    );
    if (section !== undefined) {
      const { subjectId, nameTh, nameEn, credit, creditStr } = course;
      return makePlanEntry({
        snapshot: buildSnapshot(section, {
          subjectId,
          nameTh,
          nameEn,
          credit,
          creditStr,
        }),
      });
    }
  }
  throw new Error(`section ${teachTableId} is not in ${FIXTURE}`);
}

// Captured sections: 01006020/1 and 01276209/902 sit the same midterm and final windows;
// 01286111 is a declared pair whose lecture half 1 carries the windows and whose practice
// half 2 carries none, and 01286324/1 shares its windows; 01076034/1 announces a final
// only; 01006031/41 sits alone on its days.
const CAPTURED = [
  '136485',
  '135246',
  '136609',
  '136610',
  '137094',
  '133555',
  '137882',
];

function entryWith(
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

describe('buildExamSchedule over the with-exams capture', () => {
  const schedule = buildExamSchedule(CAPTURED.map(captureEntry));

  it('lists midterm before final and every day in date order', () => {
    expect(schedule.groups.map((group) => group.kind)).toEqual([
      'midterm',
      'final',
    ]);
    expect(schedule.groups[0]?.days.map((day) => day.date)).toEqual([
      '2026-08-17',
      '2026-08-21',
    ]);
    expect(schedule.groups[1]?.days.map((day) => day.date)).toEqual([
      '2026-10-26',
      '2026-10-30',
    ]);
  });

  it('orders a day by start time and reads its weekday from the date', () => {
    const day = schedule.groups[0]?.days[1];
    expect(day?.weekday).toBe(5);
    expect(day?.rows.map((row) => row.subjectId)).toEqual([
      '01006020',
      '01276209',
      '01286111',
      '01286324',
    ]);
  });

  it('counts the subjects that share a day and leaves a lone day unmarked', () => {
    expect(schedule.groups[0]?.days[0]?.sameDayCount).toBeNull();
    expect(schedule.groups[0]?.days[1]?.sameDayCount).toBe(4);
    expect(schedule.groups[1]?.days[1]?.sameDayCount).toBe(5);
  });

  it('marks the subjects whose windows overlap and not the back to back ones', () => {
    const rows = schedule.groups[1]?.days[1]?.rows ?? [];
    const clashes = Object.fromEntries(
      rows.map((row) => [
        row.subjectId,
        row.clashesWith.map((clash) => clash.subjectId),
      ]),
    );
    expect(clashes).toEqual({
      '01006020': ['01276209'],
      '01276209': ['01006020'],
      '01286111': ['01286324', '01076034'],
      '01286324': ['01286111', '01076034'],
      '01076034': ['01286111', '01286324'],
    });
    expect(schedule.groups[0]?.days[0]?.rows[0]?.clashesWith).toEqual([]);
    expect(schedule.hasClash).toBe(true);
  });

  it('names a clash by the other subject and section', () => {
    const row = schedule.groups[0]?.days[1]?.rows[0];
    expect(row?.clashesWith).toEqual([
      {
        teachTableId: '135246',
        subjectId: '01276209',
        section: '902',
        nameTh: 'DISCRETE MATHEMATICS',
        nameEn: 'DISCRETE MATHEMATICS',
      },
    ]);
  });

  it('lists the pair under the half that carries the window', () => {
    const pair = schedule.groups[0]?.days[1]?.rows.find(
      (row) => row.subjectId === '01286111',
    );
    expect(pair?.sections).toEqual(['1']);
  });

  it('lists a final only subject under finals alone', () => {
    const midterms = schedule.groups[0]?.days.flatMap((day) => day.rows) ?? [];
    expect(midterms.some((row) => row.subjectId === '01076034')).toBe(false);
  });
});

describe('buildExamSchedule edge cases', () => {
  const MID = { start: '2026-08-21 09:00:00', end: '2026-08-21 12:00:00' };

  it('returns no groups for an empty plan', () => {
    expect(buildExamSchedule([])).toEqual({
      groups: [],
      hasClash: false,
    });
  });

  it('never lists or blocks on a malformed window', () => {
    const schedule = buildExamSchedule([
      entryWith('a', '10000001', { midterm: MID }),
      entryWith('b', '10000002', {
        midterm: { start: '21/08/2026 10:00', end: '21/08/2026 11:00' },
      }),
      entryWith('c', '10000003', {
        midterm: { start: '2026-08-21 11:00:00', end: '2026-08-21 10:00:00' },
      }),
    ]);
    const rows = schedule.groups[0]?.days[0]?.rows ?? [];
    expect(rows.map((row) => row.subjectId)).toEqual(['10000001']);
    expect(rows[0]?.clashesWith).toEqual([]);
    expect(schedule.hasClash).toBe(false);
  });

  it('merges sections of one subject that share a window and keeps the note', () => {
    const schedule = buildExamSchedule([
      entryWith('a', '10000001', { midterm: MID }, '102'),
      entryWith(
        'b',
        '10000001',
        { midterm: MID, note: ' สอบที่ห้อง E12 ' },
        '2',
      ),
    ]);
    const row = schedule.groups[0]?.days[0]?.rows[0];
    expect(row?.sections).toEqual(['2', '102']);
    expect(row?.note).toBe('สอบที่ห้อง E12');
    expect(row?.clashesWith).toEqual([]);
    expect(schedule.groups[0]?.days[0]?.sameDayCount).toBeNull();
  });

  it('reads no weekday for a date that is not a real calendar day', () => {
    const schedule = buildExamSchedule([
      entryWith('a', '10000001', {
        final: { start: '2026-02-30 09:00:00', end: '2026-02-30 12:00:00' },
      }),
    ]);
    expect(schedule.groups[0]?.days[0]?.weekday).toBeNull();
  });
});
