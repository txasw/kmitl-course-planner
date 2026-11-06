import { describe, it, expect } from 'vitest';
import { teachTableResponseSchema } from '../domain/schemas';
import { loadFixture } from '../../../tests/support/fixtures';
import { parseCreditLps } from './creditLps';

// Every teach table capture and regression payload, so the census covers each credit
// triple the live API has returned rather than a hand picked sample.
const CAPTURES = [
  'teach-table.by_class.capture.json',
  'teach-table.by_subject_id.capture.json',
  'teach-table.by_subject_owner_id-32.capture.json',
  'teach-table.multi-meeting.capture.json',
  'teach-table.with-exams.capture.json',
  'regressions/teach-table.by_class-null-teachtime-str.capture.json',
  'regressions/teach-table.fit-regression.json',
];

interface CapturedCredit {
  credit: string;
  creditLps: string;
  creditStr: string;
}

function capturedCredits(): CapturedCredit[] {
  const credits = new Map<string, CapturedCredit>();
  for (const name of CAPTURES) {
    const response = teachTableResponseSchema.parse(loadFixture(name));
    for (const grouping of response) {
      for (const block of grouping.teachtable) {
        for (const row of block.data) {
          credits.set(row.credit_str, {
            credit: row.credit,
            creditLps: row.credit_lps,
            creditStr: row.credit_str,
          });
        }
      }
    }
  }
  return [...credits.values()];
}

describe('parseCreditLps', () => {
  it('parses every captured credit_lps and credit_str value to the same hours', () => {
    const credits = capturedCredits();
    expect(credits.length).toBeGreaterThanOrEqual(15);
    for (const { credit, creditLps, creditStr } of credits) {
      const hours = parseCreditLps(creditLps);
      expect(hours, creditLps).not.toBeNull();
      expect(parseCreditLps(creditStr), creditStr).toEqual(hours);
      // The credit_str is the credit count followed by the very same triple.
      expect(creditStr).toBe(`${credit}${creditLps}`);
    }
  });

  it('reads the lecture, practice, and self study hours in order', () => {
    expect(parseCreditLps('3(2-3-6)')).toEqual({
      lecture: 2,
      practice: 3,
      selfStudy: 6,
    });
    expect(parseCreditLps('(3-0-6)')).toEqual({
      lecture: 3,
      practice: 0,
      selfStudy: 6,
    });
  });

  it('reads two digit hours such as a practicum triple', () => {
    expect(parseCreditLps('6(0-45-0)')).toEqual({
      lecture: 0,
      practice: 45,
      selfStudy: 0,
    });
    expect(parseCreditLps('(6-0-12)')).toEqual({
      lecture: 6,
      practice: 0,
      selfStudy: 12,
    });
  });

  it('accepts half hours and surrounding whitespace', () => {
    expect(parseCreditLps(' 2(1.5-1-3.5) ')).toEqual({
      lecture: 1.5,
      practice: 1,
      selfStudy: 3.5,
    });
  });

  it('returns null for malformed input', () => {
    for (const raw of [
      '',
      '3',
      '()',
      '(2-3)',
      '(2-3-6-1)',
      '2-3-6',
      '3(2-3-6',
      '3 (2-3-6)',
      '(a-3-6)',
      '(-1-3-6)',
      '(2.-3-6)',
      '(2/3/6)',
      'x(2-3-6)',
      '(2-3-6)x',
    ]) {
      expect(parseCreditLps(raw), raw).toBeNull();
    }
  });
});
