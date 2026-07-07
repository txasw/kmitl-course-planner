import { describe, it, expect } from 'vitest';
import {
  makeCourse,
  makeMeeting,
  makePlan,
  makePlanEntry,
  makeSection,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import type { Section } from '../domain/types';
import {
  buildSectionIndex,
  diffSnapshot,
  revalidateEntry,
  revalidatePlan,
  type SectionIndex,
} from './revalidate';

function indexFrom(sections: Section[]): SectionIndex {
  return buildSectionIndex([
    { courses: [makeCourse({ sections })], duplicateCount: 0, warnings: [] },
  ]);
}

describe('revalidateEntry', () => {
  it('reports unchanged when the fresh section matches the snapshot', () => {
    const entry = makePlanEntry({ snapshot: makeSnapshot() });
    const result = revalidateEntry(entry, indexFrom([makeSection()]));
    expect(result.outcome).toBe('unchanged');
    expect(result.changes).toEqual([]);
    expect(result.keyChanged).toBe(false);
  });

  it('matches by durable identity when the teachTableId changed, silently', () => {
    const entry = makePlanEntry({ snapshot: makeSnapshot() });
    const moved = makeSection({ teachTableId: 't2' });
    const result = revalidateEntry(entry, indexFrom([moved]));
    expect(result.outcome).toBe('unchanged');
    expect(result.keyChanged).toBe(true);
    expect(result.freshTeachTableId).toBe('t2');
  });

  it('flags a moved meeting time as changed', () => {
    const entry = makePlanEntry({ snapshot: makeSnapshot() });
    const moved = makeSection({
      meetings: [makeMeeting({ startMin: 600, endMin: 780 })],
    });
    const result = revalidateEntry(entry, indexFrom([moved]));
    expect(result.outcome).toBe('changed');
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
    expect(result.outcome).toBe('missing');
    expect(result.freshTeachTableId).toBeNull();
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

describe('revalidatePlan', () => {
  it('summarizes outcomes across all entries', () => {
    const present = makePlanEntry({ snapshot: makeSnapshot() });
    const gone = makePlanEntry({
      snapshot: makeSnapshot({
        teachTableId: 'g1',
        subjectId: 'GONE',
        section: '800',
      }),
    });
    const plan = makePlan({ entries: [present, gone] });
    const result = revalidatePlan(plan, indexFrom([makeSection()]));
    expect(result.summary).toEqual({
      total: 2,
      unchanged: 1,
      changed: 0,
      missing: 1,
    });
  });
});
