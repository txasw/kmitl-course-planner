import { describe, it, expect } from 'vitest';
import {
  makeMeeting,
  makePlanEntry,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import type { EntryReview } from '../domain/plan';
import {
  CHANGE_CLASS,
  isMaterial,
  materialKinds,
  mergeReview,
  withReview,
} from './review';

const T1 = '2026-11-01T00:00:00.000Z';
const T2 = '2026-11-02T00:00:00.000Z';
const SHOWN = '2026-11-01T00:05:00.000Z';

const original = makeSnapshot();
const movedTime = makeSnapshot({
  meetings: [makeMeeting({ startMin: 600, endMin: 780 })],
});
const movedExam = makeSnapshot({
  exam: {
    final: { start: '2026-11-20 09:00:00', end: '2026-11-20 12:00:00' },
  },
});
const movedBoth = makeSnapshot({
  meetings: movedTime.meetings,
  exam: movedExam.exam,
});

describe('change classification', () => {
  it('treats seats and teachers as ambient and everything else as material', () => {
    expect(CHANGE_CLASS).toEqual({
      time_changed: 'material',
      room_changed: 'material',
      pair_changed: 'material',
      exam_changed: 'material',
      teacher_changed: 'ambient',
      seats_changed: 'ambient',
    });
    expect(isMaterial('exam_changed')).toBe(true);
    expect(isMaterial('seats_changed')).toBe(false);
    expect(isMaterial('teacher_changed')).toBe(false);
  });
});

describe('materialKinds', () => {
  it('lists nothing for identical sections', () => {
    expect(materialKinds(makeSnapshot(), makeSnapshot())).toEqual([]);
  });

  it('ignores seat counts, a section turning full, and teacher changes', () => {
    const current = makeSnapshot({
      seats: { limit: 40, preCount: 55, queueLeft: 0, enrolled: 'full' },
      teachersTh: ['อ. ใหม่'],
    });
    expect(materialKinds(makeSnapshot(), current)).toEqual([]);
  });

  it('lists time, room, pair and exam changes in the diff order', () => {
    const current = makeSnapshot({
      meetings: [makeMeeting({ startMin: 600, endMin: 780, room: 'B202' })],
      pairedSection: '902',
      exam: {
        final: { start: '2026-11-20 09:00:00', end: '2026-11-20 12:00:00' },
      },
    });
    expect(materialKinds(makeSnapshot(), current)).toEqual([
      'time_changed',
      'room_changed',
      'pair_changed',
      'exam_changed',
    ]);
  });

  it('lists a section that turned closed but not one that reopened', () => {
    const open = makeSnapshot();
    const closed = makeSnapshot({ isClosed: true });
    expect(materialKinds(open, closed)).toEqual(['closed']);
    expect(materialKinds(closed, open)).toEqual([]);
  });
});

describe('mergeReview', () => {
  it('opens no review when a run changes only ambient fields', () => {
    const entry = makePlanEntry({ snapshot: original });
    const seats = makeSnapshot({
      seats: { limit: 40, preCount: 41, queueLeft: 0, enrolled: 'full' },
    });
    expect(mergeReview(entry, seats, T1)).toBeUndefined();
  });

  it('opens a review against the snapshot the run replaced', () => {
    const entry = makePlanEntry({ snapshot: original });
    expect(mergeReview(entry, movedTime, T1)).toEqual({
      kinds: ['time_changed'],
      before: original,
      detectedAt: T1,
      notifiedAt: null,
    });
  });

  it('keeps the earliest before and unions the kinds of a later run', () => {
    const review: EntryReview = {
      kinds: ['time_changed'],
      before: original,
      detectedAt: T1,
      notifiedAt: SHOWN,
    };
    const entry = makePlanEntry({ snapshot: movedTime, review });
    const merged = mergeReview(entry, movedBoth, T2);
    expect(merged?.before).toBe(original);
    expect(merged?.kinds).toEqual(['time_changed', 'exam_changed']);
    expect(merged?.detectedAt).toBe(T1);
    // The exam change is new to the student, so the item asks to be shown again.
    expect(merged?.notifiedAt).toBeNull();
  });

  it('keeps the review and its notification through a clean run', () => {
    const review: EntryReview = {
      kinds: ['time_changed'],
      before: original,
      detectedAt: T1,
      notifiedAt: SHOWN,
    };
    const entry = makePlanEntry({ snapshot: movedTime, review });
    expect(mergeReview(entry, movedTime, T2)).toEqual(review);
  });

  it('drops a kind when a later run returns the old value', () => {
    const review: EntryReview = {
      kinds: ['time_changed', 'exam_changed'],
      before: original,
      detectedAt: T1,
      notifiedAt: SHOWN,
    };
    const entry = makePlanEntry({ snapshot: movedBoth, review });
    expect(mergeReview(entry, movedExam, T2)).toEqual({
      ...review,
      kinds: ['exam_changed'],
    });
  });

  it('clears the review when every kind returns to the old value', () => {
    const review: EntryReview = {
      kinds: ['closed'],
      before: original,
      detectedAt: T1,
      notifiedAt: null,
    };
    const closed = makeSnapshot({ isClosed: true });
    const entry = makePlanEntry({ snapshot: closed, review });
    expect(mergeReview(entry, original, T2)).toBeUndefined();
  });

  it('records a section no longer listed, and drops that when it returns', () => {
    const entry = makePlanEntry({
      snapshot: original,
      verifyStatus: 'verified',
    });
    const missing = mergeReview(entry, null, T1);
    expect(missing?.kinds).toEqual(['missing']);
    const returned = makePlanEntry({
      snapshot: original,
      verifyStatus: 'missing',
      ...(missing === undefined ? {} : { review: missing }),
    });
    expect(mergeReview(returned, movedTime, T2)).toEqual({
      kinds: ['time_changed'],
      before: original,
      detectedAt: T1,
      notifiedAt: null,
    });
  });

  it('does not reopen a missing section the student already acknowledged', () => {
    const entry = makePlanEntry({
      snapshot: original,
      verifyStatus: 'missing',
    });
    expect(mergeReview(entry, null, T2)).toBeUndefined();
  });
});

describe('withReview', () => {
  it('sets a review and leaves the key out once nothing is left', () => {
    const review: EntryReview = {
      kinds: ['room_changed'],
      before: original,
      detectedAt: T1,
      notifiedAt: null,
    };
    const entry = makePlanEntry();
    const reviewed = withReview(entry, review);
    expect(reviewed.review).toBe(review);
    expect(withReview(reviewed, undefined)).not.toHaveProperty('review');
    expect(withReview(entry, undefined)).toBe(entry);
  });
});
