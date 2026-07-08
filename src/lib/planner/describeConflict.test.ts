import { describe, it, expect } from 'vitest';
import type { ConflictDetail } from './placement';
import { describeConflicts } from './describeConflict';

const blocking = { teachTableId: 't', subjectId: '90000001', section: '901' };

describe('describeConflicts', () => {
  it('returns null when there are no conflicts', () => {
    expect(describeConflicts([])).toBeNull();
  });

  it('describes a time conflict with its day and range', () => {
    const conflicts: ConflictDetail[] = [
      { kind: 'time', blocking, day: 1, startMin: 540, endMin: 600 },
    ];
    expect(describeConflicts(conflicts)).toEqual({
      kind: 'time',
      subjectId: '90000001',
      section: '901',
      day: 1,
      startMin: 540,
      endMin: 600,
      moreCount: 0,
    });
  });

  it('describes a duplicate conflict without a day or range', () => {
    const conflicts: ConflictDetail[] = [
      { kind: 'duplicate', blocking, subjectId: '90000001' },
    ];
    const description = describeConflicts(conflicts);
    expect(description?.kind).toBe('duplicate');
    expect(description?.day).toBeNull();
    expect(description?.startMin).toBeNull();
  });

  it('counts the conflicts beyond the first', () => {
    const conflicts: ConflictDetail[] = [
      { kind: 'time', blocking, day: 1, startMin: 540, endMin: 600 },
      { kind: 'time', blocking, day: 2, startMin: 540, endMin: 600 },
      { kind: 'time', blocking, day: 3, startMin: 540, endMin: 600 },
    ];
    expect(describeConflicts(conflicts)?.moreCount).toBe(2);
  });
});
