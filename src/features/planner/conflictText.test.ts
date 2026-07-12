import { describe, it, expect } from 'vitest';
import { createTranslator } from '@/lib/i18n/t';
import type { ConflictDescription } from '@/lib/planner/describeConflict';
import { conflictReasonText } from './conflictText';

const t = createTranslator('en');
const base = {
  subjectId: '90000001',
  section: '901',
  day: null,
  startMin: null,
  endMin: null,
  examKind: null,
  examWindow: null,
  moreCount: 0,
};

describe('conflictReasonText', () => {
  it('names the blocking subject, day, and range for a time conflict', () => {
    const description: ConflictDescription = {
      ...base,
      kind: 'time',
      day: 1,
      startMin: 540,
      endMin: 600,
    };
    const text = conflictReasonText(description, t);
    expect(text).toContain('90000001');
    expect(text).toContain('09:00-10:00');
  });

  it('names the exam type and its Buddhist date range for an exam conflict', () => {
    const description: ConflictDescription = {
      ...base,
      kind: 'exam',
      examKind: 'midterm',
      examWindow: { start: '2026-08-21 09:00:00', end: '2026-08-21 12:00:00' },
    };
    const text = conflictReasonText(description, t);
    expect(text).toContain('Exam clashes with');
    expect(text).toContain('90000001');
    expect(text).toContain('Midterm');
    expect(text).toContain('21 Aug 2569 09:00-12:00');
  });

  it('appends a count suffix when more conflicts follow', () => {
    const description: ConflictDescription = {
      ...base,
      kind: 'exam',
      examKind: 'final',
      examWindow: { start: '2026-10-30 09:00:00', end: '2026-10-30 12:00:00' },
      moreCount: 2,
    };
    expect(conflictReasonText(description, t)).toContain('(+2)');
  });

  it('states the duplicate reason without a range', () => {
    const description: ConflictDescription = { ...base, kind: 'duplicate' };
    expect(conflictReasonText(description, t)).toBe(
      t('section.reason.duplicate'),
    );
  });
});
