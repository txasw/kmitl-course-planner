import { describe, it, expect } from 'vitest';
import {
  summarizeCredits,
  summarizeWeeklyHours,
  totalCredits,
} from './credits';

describe('summarizeCredits', () => {
  it('returns zero for an empty plan', () => {
    expect(summarizeCredits([])).toEqual({ credits: 0, subjects: 0 });
  });

  it('counts a subject once when its lecture and practice are both placed', () => {
    const summary = summarizeCredits([
      { subjectId: 'X', credit: 3 },
      { subjectId: 'X', credit: 3 },
      { subjectId: 'Y', credit: 2 },
    ]);
    expect(summary).toEqual({ credits: 5, subjects: 2 });
  });

  it('sums distinct subjects', () => {
    expect(
      totalCredits([
        { subjectId: 'A', credit: 3 },
        { subjectId: 'B', credit: 1 },
        { subjectId: 'C', credit: 4 },
      ]),
    ).toBe(8);
  });
});

describe('summarizeWeeklyHours', () => {
  it('returns zero hours for an empty plan', () => {
    expect(summarizeWeeklyHours([])).toEqual({
      lecture: 0,
      practice: 0,
      selfStudy: 0,
      unstated: 0,
    });
  });

  it('counts a subject once when both halves of its pair are placed', () => {
    expect(
      summarizeWeeklyHours([
        { subjectId: 'X', creditStr: '3(2-3-6)' },
        { subjectId: 'X', creditStr: '3(2-3-6)' },
        { subjectId: 'Y', creditStr: '3(3-0-6)' },
      ]),
    ).toEqual({ lecture: 5, practice: 3, selfStudy: 12, unstated: 0 });
  });

  it('leaves a subject with no stated hours out of the sums and counts it apart', () => {
    expect(
      summarizeWeeklyHours([
        { subjectId: 'A', creditStr: '1(0-2-1)' },
        { subjectId: 'B', creditStr: '3' },
        { subjectId: 'C', creditStr: '' },
      ]),
    ).toEqual({ lecture: 0, practice: 2, selfStudy: 1, unstated: 2 });
  });
});
