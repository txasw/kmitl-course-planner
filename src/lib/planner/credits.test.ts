import { describe, it, expect } from 'vitest';
import {
  CREDIT_RANGE,
  creditLoad,
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

describe('creditLoad', () => {
  it('states the regulation load for each semester', () => {
    expect(CREDIT_RANGE).toEqual({
      '1': { min: 9, max: 22 },
      '2': { min: 9, max: 22 },
      '3': { min: null, max: 9 },
    });
  });

  it.each(['1', '2'] as const)(
    'keeps 9 through 22 credits within the regular load of semester %s',
    (semester) => {
      expect(creditLoad(9, semester, 3)).toEqual({ kind: 'within' });
      expect(creditLoad(22, semester, 7)).toEqual({ kind: 'within' });
    },
  );

  it.each(['1', '2'] as const)(
    'notes a total below 9 or above 22 in semester %s',
    (semester) => {
      expect(creditLoad(8, semester, 3)).toEqual({ kind: 'below', min: 9 });
      expect(creditLoad(23, semester, 8)).toEqual({ kind: 'above', max: 22 });
    },
  );

  it('never notes an empty plan as below the load', () => {
    expect(creditLoad(0, '1', 0)).toEqual({ kind: 'within' });
    expect(creditLoad(0, '2', 0)).toEqual({ kind: 'within' });
  });

  it('notes a plan whose entries carry no credit as below the load', () => {
    expect(creditLoad(0, '1', 1)).toEqual({ kind: 'below', min: 9 });
  });

  it('caps the special term at 9 credits with no minimum', () => {
    expect(creditLoad(1, '3', 1)).toEqual({ kind: 'within' });
    expect(creditLoad(9, '3', 3)).toEqual({ kind: 'within' });
    expect(creditLoad(10, '3', 4)).toEqual({ kind: 'above', max: 9 });
  });
});
