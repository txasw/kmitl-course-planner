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
  it('collapses a same day window and drops seconds', () => {
    expect(
      formatExamRange({
        start: '2026-08-21 09:00:00',
        end: '2026-08-21 12:00:00',
      }),
    ).toBe('2026-08-21 09:00-12:00');
  });

  it('shows both datetimes when the window spans days', () => {
    expect(
      formatExamRange({
        start: '2026-08-21 09:00:00',
        end: '2026-08-22 12:00:00',
      }),
    ).toBe('2026-08-21 09:00 2026-08-22 12:00');
  });

  it('falls back to the raw strings for a malformed value', () => {
    expect(formatExamRange({ start: 'x', end: 'y' })).toBe('x y');
  });
});
