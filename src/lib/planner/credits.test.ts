import { describe, it, expect } from 'vitest';
import { summarizeCredits, totalCredits } from './credits';

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
