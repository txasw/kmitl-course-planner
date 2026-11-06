import { describe, it, expect } from 'vitest';
import type { PlanEntry, ReviewKind } from '../domain/plan';
import {
  makeMeeting,
  makePlanEntry,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import {
  buildUpdateReview,
  countUpdateItems,
  hasUpdateItems,
  withRemovedItems,
  type ConflictsById,
} from './updateReview';

const NONE: ConflictsById = new Map();

function reviewed(
  id: string,
  kinds: ReviewKind[],
  overrides: Partial<PlanEntry> = {},
): PlanEntry {
  const snapshot = makeSnapshot({
    teachTableId: id,
    subjectId: `9000000${id}`,
  });
  return makePlanEntry({
    snapshot,
    verifyStatus: 'changed',
    review: {
      kinds,
      before: snapshot,
      detectedAt: '2026-11-06T00:00:00.000Z',
      notifiedAt: null,
    },
    ...overrides,
  });
}

function review(entries: PlanEntry[], time = NONE, exam = NONE) {
  return buildUpdateReview({
    entries,
    timeConflicts: time,
    examConflicts: exam,
  });
}

describe('buildUpdateReview', () => {
  it('keeps entries with nothing to review in the unchanged group', () => {
    const plain = makePlanEntry({ verifyStatus: 'verified' });
    const result = review([plain]);
    expect(result.groups).toEqual([]);
    expect(result.unchanged).toEqual([plain]);
  });

  it('orders the groups clash, exam, time and room, then other', () => {
    const result = review([
      reviewed('1', ['pair_changed']),
      reviewed('2', ['room_changed']),
      reviewed('3', ['exam_changed']),
      reviewed('4', ['missing'], { verifyStatus: 'missing' }),
    ]);
    expect(result.groups.map((group) => group.key)).toEqual([
      'clash',
      'exam',
      'timeRoom',
      'other',
    ]);
  });

  it('places an item once, in the most urgent group its kinds reach', () => {
    const result = review([reviewed('1', ['time_changed', 'exam_changed'])]);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.key).toBe('exam');
  });

  it('lists a missing entry the student already acknowledged', () => {
    const entry = makePlanEntry({ verifyStatus: 'missing' });
    const [group] = review([entry]).groups;
    expect(group?.key).toBe('clash');
    expect(group?.items[0]?.kinds).toEqual(['missing']);
    expect(group?.items[0]?.after).toBeNull();
    expect(group?.items[0]?.changes).toEqual([]);
  });

  it('describes the change from the reviewed snapshot without seat counts', () => {
    const before = makeSnapshot({
      meetings: [makeMeeting({ startMin: 540 })],
      teachersEn: ['A'],
    });
    const now = makeSnapshot({
      meetings: [makeMeeting({ startMin: 600, endMin: 780 })],
      teachersEn: ['B'],
      seats: { limit: 40, preCount: 3, queueLeft: 30, enrolled: 9 },
    });
    const entry = makePlanEntry({
      snapshot: now,
      verifyStatus: 'changed',
      review: {
        kinds: ['time_changed'],
        before,
        detectedAt: '2026-11-06T00:00:00.000Z',
        notifiedAt: null,
      },
    });
    const item = review([entry]).groups[0]?.items[0];
    expect(item?.before).toBe(before);
    expect(item?.after).toBe(now);
    expect(item?.changes).toEqual(['time_changed', 'teacher_changed']);
  });

  it('moves a time change that created a clash into the clash group', () => {
    const entry = reviewed('1', ['time_changed']);
    const time: ConflictsById = new Map([
      [
        '1',
        [
          {
            blocking: {
              teachTableId: '2',
              subjectId: '90000002',
              section: '7',
            },
          },
          {
            blocking: {
              teachTableId: '2',
              subjectId: '90000002',
              section: '7',
            },
          },
        ],
      ],
    ]);
    const [group] = review([entry], time).groups;
    expect(group?.key).toBe('clash');
    expect(group?.items[0]?.clashes).toEqual([
      { subjectId: '90000002', section: '7' },
    ]);
  });

  it('ignores a clash the review kinds did not create', () => {
    const entry = reviewed('1', ['room_changed']);
    const conflicts: ConflictsById = new Map([
      [
        '1',
        [{ blocking: { teachTableId: '2', subjectId: '9', section: '7' } }],
      ],
    ]);
    const [group] = review([entry], conflicts, conflicts).groups;
    expect(group?.key).toBe('timeRoom');
    expect(group?.items[0]?.clashes).toEqual([]);
  });

  it('counts an exam clash for an exam change', () => {
    const entry = reviewed('1', ['exam_changed']);
    const exam: ConflictsById = new Map([
      [
        '1',
        [{ blocking: { teachTableId: '2', subjectId: '9', section: '7' } }],
      ],
    ]);
    expect(review([entry], NONE, exam).groups[0]?.key).toBe('clash');
  });
});

describe('hasUpdateItems', () => {
  it('is true for an open review or a missing entry and false otherwise', () => {
    expect(hasUpdateItems([makePlanEntry({ verifyStatus: 'verified' })])).toBe(
      false,
    );
    expect(hasUpdateItems([reviewed('1', ['room_changed'])])).toBe(true);
    expect(hasUpdateItems([makePlanEntry({ verifyStatus: 'missing' })])).toBe(
      true,
    );
  });
});

describe('countUpdateItems', () => {
  it('counts each entry with an open review or a missing status once', () => {
    expect(countUpdateItems([])).toBe(0);
    expect(
      countUpdateItems([
        makePlanEntry({ verifyStatus: 'verified' }),
        reviewed('1', ['room_changed', 'time_changed']),
        reviewed('2', ['missing'], { verifyStatus: 'missing' }),
        makePlanEntry({ verifyStatus: 'missing' }),
        makePlanEntry({ verifyStatus: 'changed' }),
      ]),
    ).toBe(3);
  });

  it('counts the same entries the dialog lists as items', () => {
    const entries = [
      makePlanEntry({ verifyStatus: 'verified' }),
      reviewed('1', ['pair_changed']),
      reviewed('2', ['exam_changed']),
      makePlanEntry({ verifyStatus: 'missing' }),
    ];
    const listed = review(entries).groups.flatMap((group) => group.items);
    expect(countUpdateItems(entries)).toBe(listed.length);
  });

  it('agrees with hasUpdateItems on every case', () => {
    const cases: PlanEntry[][] = [
      [],
      [makePlanEntry({ verifyStatus: 'verified' })],
      [makePlanEntry({ verifyStatus: 'unverified' })],
      [makePlanEntry({ verifyStatus: 'changed' })],
      [makePlanEntry({ verifyStatus: 'missing' })],
      [reviewed('1', ['closed'])],
      [makePlanEntry({ verifyStatus: 'verified' }), reviewed('2', ['missing'])],
    ];
    for (const entries of cases) {
      expect(hasUpdateItems(entries)).toBe(countUpdateItems(entries) > 0);
    }
  });
});

describe('withRemovedItems', () => {
  const missing = reviewed('1', ['missing'], { verifyStatus: 'missing' });
  const moved = reviewed('2', ['room_changed']);

  it('lists a removed item in the clash group while its entry is gone', () => {
    const removedItem = review([missing]).groups[0]?.items[0];
    if (removedItem === undefined) throw new Error('expected an item');
    const live = review([moved]).groups;
    const result = withRemovedItems(live, [removedItem], [moved]);
    expect(result.groups.map((group) => group.key)).toEqual([
      'clash',
      'timeRoom',
    ]);
    expect(result.groups[0]?.items).toEqual([removedItem]);
    expect(result.removedIds).toEqual(new Set(['1']));
  });

  it('drops a removed item once an undo brings its entry back', () => {
    const live = review([missing]).groups;
    const removedItem = live[0]?.items[0];
    if (removedItem === undefined) throw new Error('expected an item');
    const result = withRemovedItems(live, [removedItem], [missing]);
    expect(result.groups).toEqual(live);
    expect(result.removedIds.size).toBe(0);
  });
});
