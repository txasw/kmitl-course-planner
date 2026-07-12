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
import type { Plan, SourceQuery } from '../domain/plan';
import {
  buildSectionIndex,
  diffSnapshot,
  reconcilePlan,
  revalidateEntry,
  revalidatePlan,
  type SectionIndex,
} from './revalidate';
import { planExamConflicts } from './examOverlap';
import { placedSections } from './transaction';

const NOW = '2026-07-09T00:00:00.000Z';

function indexFrom(sections: Section[]): SectionIndex {
  return buildSectionIndex([
    { courses: [makeCourse({ sections })], duplicateCount: 0, warnings: [] },
  ]);
}

// Index each fresh section under its own course so the subject metadata reconcile
// rebuilds matches the section's subject.
function reconcile(plan: Plan, fresh: Section[]) {
  const courses = fresh.map((section) =>
    makeCourse({ subjectId: section.subjectId, sections: [section] }),
  );
  const index = buildSectionIndex([
    { courses, duplicateCount: 0, warnings: [] },
  ]);
  return reconcilePlan(plan, index, NOW);
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

describe('reconcilePlan', () => {
  it('updates a changed entry to fresh data and records old versus new', () => {
    const entry = makePlanEntry({
      snapshot: makeSnapshot({
        teachTableId: 't1',
        subjectId: 'S1',
        section: '901',
      }),
    });
    const plan = makePlan({ entries: [entry] });
    const fresh = makeSection({
      teachTableId: 't1',
      subjectId: 'S1',
      section: '901',
      meetings: [makeMeeting({ startMin: 600, endMin: 780 })],
    });
    const { plan: reconciled, report } = reconcile(plan, [fresh]);
    const updated = reconciled.entries[0];
    expect(updated?.verifyStatus).toBe('changed');
    expect(updated?.lastVerifiedAt).toBe(NOW);
    expect(updated?.snapshot.meetings[0]?.startMin).toBe(600);
    expect(report.entries[0]?.changes).toContain('time_changed');
    expect(report.entries[0]?.before.meetings[0]?.startMin).toBe(540);
    expect(report.entries[0]?.after?.meetings[0]?.startMin).toBe(600);
  });

  it('keeps a missing entry at its last known snapshot and flags it', () => {
    const entry = makePlanEntry({
      snapshot: makeSnapshot({
        teachTableId: 't1',
        subjectId: 'S1',
        section: '901',
      }),
    });
    const plan = makePlan({ entries: [entry] });
    const { plan: reconciled, report } = reconcile(plan, [
      makeSection({ teachTableId: 'zzz', subjectId: 'OTHER', section: '999' }),
    ]);
    const kept = reconciled.entries[0];
    expect(kept?.verifyStatus).toBe('missing');
    expect(kept?.snapshot.teachTableId).toBe('t1');
    expect(kept?.lastVerifiedAt).toBe(NOW);
    expect(report.entries[0]?.after).toBeNull();
  });

  it('adopts a moved teachTableId silently', () => {
    const entry = makePlanEntry({
      snapshot: makeSnapshot({
        teachTableId: 't1',
        subjectId: 'S1',
        section: '901',
      }),
    });
    const plan = makePlan({ entries: [entry] });
    const { plan: reconciled } = reconcile(plan, [
      makeSection({ teachTableId: 't2', subjectId: 'S1', section: '901' }),
    ]);
    const moved = reconciled.entries[0];
    expect(moved?.teachTableId).toBe('t2');
    expect(moved?.snapshot.teachTableId).toBe('t2');
    expect(moved?.verifyStatus).toBe('verified');
  });

  it('keeps the old key when the fresh key already belongs to another entry', () => {
    const a = makePlanEntry({
      snapshot: makeSnapshot({
        teachTableId: 'X',
        subjectId: 'S1',
        section: '901',
      }),
    });
    const b = makePlanEntry({
      snapshot: makeSnapshot({
        teachTableId: 'Y',
        subjectId: 'S2',
        section: '902',
      }),
    });
    const plan = makePlan({ entries: [a, b] });
    // The fresh S1/901 now carries teachTableId 'Y', which entry b already uses.
    const fresh = makeSection({
      teachTableId: 'Y',
      subjectId: 'S1',
      section: '901',
    });
    const { plan: reconciled } = reconcile(plan, [fresh]);
    const reconciledA = reconciled.entries.find((e) => e.subjectId === 'S1');
    expect(reconciledA?.teachTableId).toBe('X');
  });

  it('does not match an entry to a different subject that recycled its key', () => {
    const entry = makePlanEntry({
      snapshot: makeSnapshot({
        teachTableId: 't1',
        subjectId: 'S1',
        section: '901',
      }),
    });
    const plan = makePlan({ entries: [entry] });
    // A different subject now carries the entry's teachTableId.
    const { plan: reconciled } = reconcile(plan, [
      makeSection({ teachTableId: 't1', subjectId: 'S2', section: '902' }),
    ]);
    expect(reconciled.entries[0]?.verifyStatus).toBe('missing');
  });

  it('reports a term mismatch as a finding without fixing it', () => {
    const otherTerm: SourceQuery = {
      endpoint: 'get-teach-table-show',
      params: {
        mode: 'by_class',
        selected_year: '2569',
        selected_semester: '2',
      },
    };
    const entry = makePlanEntry({
      snapshot: makeSnapshot({
        teachTableId: 't1',
        subjectId: 'S1',
        section: '901',
      }),
      sourceQuery: otherTerm,
    });
    const plan = makePlan({ semester: '1', entries: [entry] });
    const { report } = reconcile(plan, [
      makeSection({ teachTableId: 't1', subjectId: 'S1', section: '901' }),
    ]);
    expect(report.termFindings).toHaveLength(1);
    expect(report.termFindings[0]?.teachTableId).toBe('t1');
  });

  it('does not touch the plan updatedAt', () => {
    const plan = makePlan({
      updatedAt: '2020-01-01T00:00:00.000Z',
      entries: [makePlanEntry()],
    });
    const { plan: reconciled } = reconcile(plan, [makeSection()]);
    expect(reconciled.updatedAt).toBe('2020-01-01T00:00:00.000Z');
  });

  it('re-evaluates exam overlaps after a revalidation moves an exam', () => {
    // Two entries whose midterms do not overlap when the plan is built.
    const plan = makePlan({
      entries: [
        makePlanEntry({
          snapshot: makeSnapshot({
            teachTableId: 'a',
            subjectId: 'S1',
            section: '1',
            exam: {
              midterm: {
                start: '2026-08-21 09:00:00',
                end: '2026-08-21 10:00:00',
              },
            },
          }),
        }),
        makePlanEntry({
          snapshot: makeSnapshot({
            teachTableId: 'b',
            subjectId: 'S2',
            section: '1',
            exam: {
              midterm: {
                start: '2026-08-22 09:00:00',
                end: '2026-08-22 10:00:00',
              },
            },
          }),
        }),
      ],
    });
    expect(planExamConflicts(placedSections(plan.entries)).size).toBe(0);

    // Upstream moves the first entry's midterm onto the second entry's day and time.
    const { plan: reconciled, report } = reconcile(plan, [
      makeSection({
        teachTableId: 'a',
        subjectId: 'S1',
        section: '1',
        exam: {
          midterm: {
            start: '2026-08-22 09:30:00',
            end: '2026-08-22 10:30:00',
          },
        },
      }),
      makeSection({
        teachTableId: 'b',
        subjectId: 'S2',
        section: '1',
        exam: {
          midterm: {
            start: '2026-08-22 09:00:00',
            end: '2026-08-22 10:00:00',
          },
        },
      }),
    ]);
    // The move is classified exam_changed, and the discovered overlap now reads danger,
    // since planExamConflicts is the source of the danger badge.
    expect(report.entries[0]?.changes).toContain('exam_changed');
    expect(planExamConflicts(placedSections(reconciled.entries)).size).toBe(2);
  });
});
