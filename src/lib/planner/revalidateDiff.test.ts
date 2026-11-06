import { describe, it, expect } from 'vitest';
import {
  makeCourse,
  makeMeeting,
  makePlanEntry,
  makeSection,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import type { OfferedTo, Section } from '../domain/types';
import {
  buildSectionIndex,
  diffSnapshot,
  revalidateEntry,
  type SectionIndex,
} from './revalidateDiff';

function indexFrom(sections: Section[]): SectionIndex {
  return buildSectionIndex([
    {
      courses: [makeCourse({ sections })],
      duplicateCount: 0,
      multiMeetingCount: 0,
      warnings: [],
    },
  ]);
}

describe('revalidateEntry', () => {
  it('reports no changes when the fresh section matches the snapshot', () => {
    const entry = makePlanEntry({ snapshot: makeSnapshot() });
    const result = revalidateEntry(entry, indexFrom([makeSection()]));
    expect(result.fresh?.section.teachTableId).toBe('t1');
    expect(result.changes).toEqual([]);
    expect(result.keyChanged).toBe(false);
  });

  it('matches by durable identity when the teachTableId changed, silently', () => {
    const entry = makePlanEntry({ snapshot: makeSnapshot() });
    const moved = makeSection({ teachTableId: 't2' });
    const result = revalidateEntry(entry, indexFrom([moved]));
    expect(result.changes).toEqual([]);
    expect(result.keyChanged).toBe(true);
    expect(result.fresh?.section.teachTableId).toBe('t2');
  });

  it('flags a moved meeting time', () => {
    const entry = makePlanEntry({ snapshot: makeSnapshot() });
    const moved = makeSection({
      meetings: [makeMeeting({ startMin: 600, endMin: 780 })],
    });
    const result = revalidateEntry(entry, indexFrom([moved]));
    expect(result.changes).toContain('time_changed');
  });

  it('flags a snapshot that gains a second meeting', () => {
    // A plan saved before teachtime_str was parsed has a one meeting snapshot; the
    // fresh truth now carries the extra period, so the meeting set grew.
    const entry = makePlanEntry({ snapshot: makeSnapshot() });
    const grown = makeSection({
      meetings: [
        makeMeeting(),
        makeMeeting({ day: 4, startMin: 630, endMin: 720 }),
      ],
    });
    const result = revalidateEntry(entry, indexFrom([grown]));
    expect(result.changes).toContain('time_changed');
  });

  it('flags a seat change including the full state', () => {
    const entry = makePlanEntry({ snapshot: makeSnapshot() });
    const full = makeSection({
      seats: { limit: 40, preCount: 0, queueLeft: 0, enrolled: 'full' },
    });
    const result = revalidateEntry(entry, indexFrom([full]));
    expect(result.changes).toEqual(['seats_changed']);
  });

  it('reports missing when neither key nor identity matches', () => {
    const entry = makePlanEntry({ snapshot: makeSnapshot() });
    const unrelated = makeSection({
      teachTableId: 'zzz',
      subjectId: 'OTHER',
      section: '999',
    });
    const result = revalidateEntry(entry, indexFrom([unrelated]));
    expect(result.changes).toEqual([]);
    expect(result.fresh).toBeNull();
  });
});

describe('diffSnapshot classifications', () => {
  it('reports no changes for an identical section', () => {
    expect(diffSnapshot(makeSnapshot(), makeSection())).toEqual([]);
  });

  it('detects a room change without a time change', () => {
    const fresh = makeSection({ meetings: [makeMeeting({ room: 'B202' })] });
    expect(diffSnapshot(makeSnapshot(), fresh)).toEqual(['room_changed']);
  });

  it('detects a teacher change', () => {
    const fresh = makeSection({ teachersTh: ['New Teacher'] });
    expect(diffSnapshot(makeSnapshot(), fresh)).toEqual(['teacher_changed']);
  });

  it('detects a pair change', () => {
    const fresh = makeSection({ pairedSection: '902' });
    expect(diffSnapshot(makeSnapshot(), fresh)).toEqual(['pair_changed']);
  });

  it('detects an exam change', () => {
    const fresh = makeSection({
      exam: {
        midterm: { start: '2026-01-01 09:00:00', end: '2026-01-01 12:00:00' },
      },
    });
    expect(diffSnapshot(makeSnapshot(), fresh)).toEqual(['exam_changed']);
  });
});

describe('offeredTo is outside the diff', () => {
  const NARROW: OfferedTo[] = [
    { facultyId: '01', departmentId: '08', curriculumId: '08', classYear: '4' },
  ];
  const WIDE: OfferedTo[] = [
    ...NARROW,
    { facultyId: '01', departmentId: 'x', curriculumId: 'x', classYear: '0' },
  ];

  it('reports no change when only the grouping list differs', () => {
    const snapshot = makeSnapshot({ offeredTo: NARROW });
    expect(diffSnapshot(snapshot, makeSection({ offeredTo: WIDE }))).toEqual(
      [],
    );
    expect(diffSnapshot(snapshot, makeSection({ offeredTo: [] }))).toEqual([]);
  });

  it('reports no change for an old snapshot without the field', () => {
    expect(
      diffSnapshot(makeSnapshot(), makeSection({ offeredTo: WIDE })),
    ).toEqual([]);
    expect(
      diffSnapshot(makeSnapshot({ offeredTo: WIDE }), makeSection()),
    ).toEqual([]);
  });

  it('matches the entry with no changes when only the grouping list differs', () => {
    const entry = makePlanEntry({
      snapshot: makeSnapshot({ offeredTo: NARROW }),
    });
    const result = revalidateEntry(
      entry,
      indexFrom([makeSection({ offeredTo: WIDE })]),
    );
    expect(result.fresh?.section.teachTableId).toBe('t1');
    expect(result.changes).toEqual([]);
  });

  it('still reports a real change alongside a grouping difference', () => {
    const fresh = makeSection({ offeredTo: WIDE, teachersTh: ['New Teacher'] });
    expect(diffSnapshot(makeSnapshot({ offeredTo: NARROW }), fresh)).toEqual([
      'teacher_changed',
    ]);
  });
});
