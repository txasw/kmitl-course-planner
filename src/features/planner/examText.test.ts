import { describe, it, expect } from 'vitest';
import { createTranslator } from '@/lib/i18n/t';
import type { ExamWarningFeedback } from './dragStore';
import { examOverlapText, formatExamRange } from './examText';

const t = createTranslator('en');

const overlap = {
  blocking: { teachTableId: 'x', subjectId: '01006001', section: '1' },
  kind: 'midterm' as const,
  self: { start: '2026-08-21 09:00:00', end: '2026-08-21 12:00:00' },
  other: { start: '2026-08-21 11:00:00', end: '2026-08-21 13:00:00' },
};

describe('examOverlapText', () => {
  it('names the first clashing subject, section, and exam kind', () => {
    const feedback: ExamWarningFeedback = {
      subjectId: '01006002',
      overlaps: [overlap],
    };
    expect(examOverlapText(feedback, t)).toBe(
      'Exam time overlaps with 01006001 Section 1 Midterm',
    );
  });

  it('adds a count suffix when more overlaps follow', () => {
    const feedback: ExamWarningFeedback = {
      subjectId: '01006002',
      overlaps: [overlap, { ...overlap, kind: 'final' }],
    };
    expect(examOverlapText(feedback, t)).toContain('(+1)');
  });
});

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
