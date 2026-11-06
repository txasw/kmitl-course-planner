import { describe, expect, it } from 'vitest';
import {
  makeCourse,
  makeMeeting,
  makeSection,
} from '../../../tests/support/domain-builders';
import { loadFixture } from '../../../tests/support/fixtures';
import { normalizeTeachTable } from '../domain/normalize';
import type { Course } from '../domain/types';
import { earliestStart } from '../planner/suggestions';
import { compareSections } from './compareSections';

function captureCourse(): Course {
  const result = normalizeTeachTable(
    loadFixture('teach-table.by_subject_id.capture.json'),
  );
  if (!result.ok) {
    throw new Error('fixture failed to normalize');
  }
  const [course] = result.value.courses;
  if (course === undefined) {
    throw new Error('fixture holds no course');
  }
  return course;
}

const codes = (rows: { section: { section: string } }[]): string[] =>
  rows.map((row) => row.section.section);

describe('compareSections over the by_subject_id capture', () => {
  const course = captureCourse();

  it('keeps every one of the 44 sections in section code order by start', () => {
    const rows = compareSections(course, [], undefined, {
      onlyAddable: false,
      sort: 'start',
    });
    expect(rows).toHaveLength(44);
    // The morning sections come first; equal starts keep the course order.
    expect(codes(rows).slice(0, 4)).toEqual(['10', '11', '12', '13']);
    const starts = rows.map((row) => earliestStart(row.section));
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    // Section 119 starts at 09:00 on another day, so it sorts with the morning group.
    expect(codes(rows).indexOf('119')).toBeLessThan(codes(rows).indexOf('14'));
  });

  it('orders by the most open seats, with full sections last', () => {
    const rows = compareSections(course, [], undefined, {
      onlyAddable: false,
      sort: 'seats',
    });
    expect(codes(rows).slice(0, 7)).toEqual([
      '13',
      '10',
      '17',
      '14',
      '15',
      '12',
      '704',
    ]);
    expect(rows.slice(7).every((row) => row.seat.kind === 'full')).toBe(true);
  });

  it('keeps only the sections with a seat when only addable is on', () => {
    const rows = compareSections(course, [], undefined, {
      onlyAddable: true,
      sort: 'start',
    });
    expect(codes(rows)).toEqual(['10', '12', '13', '14', '15', '17', '704']);
    expect(rows.every((row) => row.status === null)).toBe(true);
  });
});

describe('compareSections against a plan', () => {
  const morning = makeSection({
    teachTableId: 'm',
    section: '1',
    meetings: [makeMeeting({ day: 2, startMin: 540, endMin: 720 })],
  });
  const afternoon = makeSection({
    teachTableId: 'a',
    section: '2',
    meetings: [makeMeeting({ day: 2, startMin: 780, endMin: 960 })],
  });
  const online = makeSection({
    teachTableId: 'o',
    section: '3',
    meetings: [],
  });
  const uncapped = makeSection({
    teachTableId: 'u',
    section: '4',
    meetings: [makeMeeting({ day: 4, startMin: 600, endMin: 720 })],
    seats: { limit: null, preCount: 0, queueLeft: 0, enrolled: 3 },
  });
  const course = makeCourse({
    subjectId: '90000001',
    sections: [online, afternoon, morning, uncapped],
  });
  const blocker = makeSection({
    teachTableId: 'x',
    subjectId: '90000002',
    section: '9',
    meetings: [makeMeeting({ day: 2, startMin: 540, endMin: 600 })],
  });

  it('sorts an unscheduled section after every scheduled one', () => {
    const rows = compareSections(course, [], undefined, {
      onlyAddable: false,
      sort: 'start',
    });
    expect(codes(rows)).toEqual(['1', '4', '2', '3']);
  });

  it('ranks an uncapped section above any open count', () => {
    const rows = compareSections(course, [], undefined, {
      onlyAddable: false,
      sort: 'seats',
    });
    expect(codes(rows)[0]).toBe('4');
  });

  it('drops a clashing section from the addable rows and labels it', () => {
    const all = compareSections(course, [blocker], undefined, {
      onlyAddable: false,
      sort: 'start',
    });
    expect(all.find((row) => row.section.section === '1')?.status).toBe(
      'time_conflict',
    );
    const addable = compareSections(course, [blocker], undefined, {
      onlyAddable: true,
      sort: 'start',
    });
    expect(codes(addable)).toEqual(['4', '2', '3']);
  });

  it('keeps no row addable while another term is browsed', () => {
    const rows = compareSections(
      course,
      [],
      {
        planTerm: { year: '2569', semester: '1' },
        browsedTerm: { year: '2569', semester: '2' },
      },
      { onlyAddable: true, sort: 'start' },
    );
    expect(rows).toEqual([]);
  });
});
