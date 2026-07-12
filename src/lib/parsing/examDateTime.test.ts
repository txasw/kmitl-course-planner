import { describe, it, expect } from 'vitest';
import { loadFixture } from '../../../tests/support/fixtures';
import {
  isExamDateTime,
  parseExamDateTime,
  EXAM_DATETIME,
} from './examDateTime';

// The real datetimes come from the live with-exams capture, so the format and era cases
// are verified against what the API actually sends rather than an assumed shape.
function captureExamDatetimes(): string[] {
  const raw = loadFixture('teach-table.with-exams.capture.json') as {
    teachtable?: { data?: Record<string, unknown>[] }[];
  }[];
  const values: string[] = [];
  for (const group of raw) {
    for (const block of group.teachtable ?? []) {
      for (const row of block.data ?? []) {
        for (const key of [
          'midterm_start_date_time',
          'midterm_end_date_time',
          'final_start_date_time',
          'final_end_date_time',
        ]) {
          const value = row[key];
          if (typeof value === 'string' && value !== '') {
            values.push(value);
          }
        }
      }
    }
  }
  return values;
}

describe('isExamDateTime', () => {
  it('accepts the fixed width space separated form', () => {
    expect(isExamDateTime('2026-08-21 09:30:00')).toBe(true);
  });

  it('rejects the ISO T form, a missing seconds field, and empty', () => {
    expect(isExamDateTime('2026-08-21T09:30:00')).toBe(false);
    expect(isExamDateTime('2026-08-21 09:30')).toBe(false);
    expect(isExamDateTime('')).toBe(false);
    expect(isExamDateTime('not a datetime')).toBe(false);
  });

  it('accepts every exam datetime in the real capture', () => {
    const values = captureExamDatetimes();
    expect(values.length).toBeGreaterThan(0);
    expect(values.every((value) => EXAM_DATETIME.test(value))).toBe(true);
  });
});

describe('parseExamDateTime', () => {
  it('extracts the fields without a Date, keeping the Gregorian year', () => {
    expect(parseExamDateTime('2026-08-21 09:30:00')).toEqual({
      yearCE: 2026,
      month: 8,
      day: 21,
      hour: 9,
      minute: 30,
    });
  });

  it('returns null on a value that is not the expected shape', () => {
    expect(parseExamDateTime('2026-08-21T09:30:00')).toBeNull();
    expect(parseExamDateTime('')).toBeNull();
  });

  it('reads every capture datetime as a Gregorian year, never Buddhist', () => {
    // A Buddhist era value would read 2569, so a year under 2500 confirms the source is CE
    // and the Buddhist year is a display conversion, not the stored value.
    for (const value of captureExamDatetimes()) {
      const parts = parseExamDateTime(value);
      expect(parts).not.toBeNull();
      expect(parts?.yearCE).toBeLessThan(2500);
      expect(parts?.yearCE).toBeGreaterThan(2000);
    }
  });
});
