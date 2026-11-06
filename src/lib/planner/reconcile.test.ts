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
import { buildSectionIndex } from './revalidateDiff';
import { reconcilePlan, summarize } from './reconcile';
import { planExamConflicts } from './examOverlap';
import { placedSections } from './transaction';

const NOW = '2026-07-09T00:00:00.000Z';

// Index each fresh section under its own course so the subject metadata reconcile
// rebuilds matches the section's subject.
function reconcile(plan: Plan, fresh: Section[]) {
  const courses = fresh.map((section) =>
    makeCourse({ subjectId: section.subjectId, sections: [section] }),
  );
  const index = buildSectionIndex([
    { courses, duplicateCount: 0, multiMeetingCount: 0, warnings: [] },
  ]);
  return reconcilePlan(plan, index, NOW);
}

describe('summarize', () => {
  it('counts each outcome once', () => {
    expect(
      summarize([
        { outcome: 'unchanged' },
        { outcome: 'changed' },
        { outcome: 'missing' },
        { outcome: 'changed' },
      ]),
    ).toEqual({ total: 4, unchanged: 1, changed: 2, missing: 1 });
  });

  it('reports zeros for no entries', () => {
    expect(summarize([])).toEqual({
      total: 0,
      unchanged: 0,
      changed: 0,
      missing: 0,
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

  it('self heals a pre patch snapshot to the fuller multi meeting schedule', () => {
    // A plan saved before teachtime_str parsing has one meeting. On first open after
    // the upgrade, reconcile rewrites the snapshot to the two meeting truth, so the
    // re run conflict engine can surface any newly true conflict. Nothing is removed.
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
      meetings: [
        makeMeeting(),
        makeMeeting({ day: 4, startMin: 630, endMin: 720 }),
      ],
    });
    const { plan: reconciled, report } = reconcile(plan, [fresh]);
    const updated = reconciled.entries[0];
    expect(updated?.snapshot.meetings).toHaveLength(2);
    expect(updated?.verifyStatus).toBe('changed');
    expect(report.entries[0]?.changes).toContain('time_changed');
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
