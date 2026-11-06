import { describe, it, expect } from 'vitest';
import { createTranslator } from '@/lib/i18n/t';
import {
  examWindowTexts,
  formatExamDate,
  formatExamRange,
  formatExamTimes,
  formatLocalDateTime,
} from './examText';

const t = createTranslator('en');

describe('formatExamRange', () => {
  const th = createTranslator('th');

  it('collapses a same day window, drops seconds, and shows the Buddhist year', () => {
    // 2026 CE plus 543 is 2569 BE, the year the app displays in both locales.
    expect(
      formatExamRange(
        { start: '2026-08-21 09:00:00', end: '2026-08-21 12:00:00' },
        t,
      ),
    ).toBe('21 Aug 2569 09:00-12:00');
  });

  it('localizes the month name while keeping the Buddhist year in both locales', () => {
    expect(
      formatExamRange(
        { start: '2026-08-21 09:00:00', end: '2026-08-21 12:00:00' },
        th,
      ),
    ).toBe('21 ส.ค. 2569 09:00-12:00');
  });

  it('shows both datetimes when the window spans days', () => {
    expect(
      formatExamRange(
        { start: '2026-08-21 09:00:00', end: '2026-08-22 12:00:00' },
        t,
      ),
    ).toBe('21 Aug 2569 09:00 22 Aug 2569 12:00');
  });

  it('falls back to the raw strings for a malformed value', () => {
    expect(formatExamRange({ start: 'x', end: 'y' }, t)).toBe('x y');
  });
});

describe('formatExamDate', () => {
  it('reads a calendar day in the Buddhist year with a localized month', () => {
    const day = { yearCE: 2026, month: 12, day: 17 };
    expect(formatExamDate(day, createTranslator('th'))).toBe('17 ธ.ค. 2569');
    expect(formatExamDate(day, t)).toBe('17 Dec 2569');
  });
});

describe('formatExamTimes', () => {
  it('shows only the clock times when the window ends on its start day', () => {
    expect(
      formatExamTimes(
        { start: '2026-12-17 09:00:00', end: '2026-12-17 12:00:00' },
        t,
      ),
    ).toBe('09:00-12:00');
  });

  it('keeps the end date when the window runs into another day', () => {
    expect(
      formatExamTimes(
        { start: '2026-12-17 21:00:00', end: '2026-12-18 01:00:00' },
        t,
      ),
    ).toBe('17 Dec 2569 21:00 18 Dec 2569 01:00');
  });
});

describe('examWindowTexts', () => {
  it('lists the midterm before the final, each formatted', () => {
    expect(
      examWindowTexts(
        {
          final: { start: '2026-10-05 13:00:00', end: '2026-10-05 16:00:00' },
          midterm: { start: '2026-08-21 09:00:00', end: '2026-08-21 12:00:00' },
        },
        t,
      ),
    ).toEqual([
      { kind: 'midterm', text: '21 Aug 2569 09:00-12:00' },
      { kind: 'final', text: '5 Oct 2569 13:00-16:00' },
    ]);
  });

  it('skips an absent window and is empty when the section announces none', () => {
    expect(
      examWindowTexts(
        {
          final: { start: '2026-10-05 13:00:00', end: '2026-10-05 16:00:00' },
        },
        t,
      ),
    ).toEqual([{ kind: 'final', text: '5 Oct 2569 13:00-16:00' }]);
    expect(examWindowTexts({ note: 'Take home' }, t)).toEqual([]);
  });
});

describe('formatLocalDateTime', () => {
  it('reads the local calendar fields in the exam date convention', () => {
    // A local constructor, so the expectation does not depend on the test time zone.
    const date = new Date(2026, 10, 6, 8, 5);
    expect(formatLocalDateTime(date, t)).toBe('6 Nov 2569 08:05');
    expect(formatLocalDateTime(date, createTranslator('th'))).toBe(
      '6 พ.ย. 2569 08:05',
    );
  });
});
