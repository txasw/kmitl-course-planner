import { describe, it, expect } from 'vitest';
import {
  makeMeeting,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import { CHANGE_CLASS, isMaterial, materialKinds } from './review';

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
