import { describe, it, expect } from 'vitest';
import { createTranslator } from '@/lib/i18n/t';
import type { ConflictDescription } from '@/lib/planner/describeConflict';
import type { ConflictDetail } from '@/lib/planner/placement';
import { conflictBadgeKey, conflictReasonText } from './conflictText';

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

describe('conflictBadgeKey', () => {
  const blocking = { teachTableId: '1', subjectId: '90000001', section: '901' };
  const exam: ConflictDetail = {
    kind: 'exam',
    blocking,
    examKind: 'midterm',
    self: { start: '2026-08-21 11:00:00', end: '2026-08-21 13:00:00' },
    other: { start: '2026-08-21 09:00:00', end: '2026-08-21 12:00:00' },
  };
  const time: ConflictDetail = {
    kind: 'time',
    blocking,
    day: 1,
    startMin: 540,
    endMin: 600,
  };

  it('reads an exam clash when every conflict is an exam overlap', () => {
    expect(conflictBadgeKey([exam, { ...exam, examKind: 'final' }])).toBe(
      'section.badge.examConflict',
    );
  });

  it('keeps the time conflict badge when a time clash is among them', () => {
    expect(conflictBadgeKey([exam, time])).toBe('section.badge.conflict');
    expect(conflictBadgeKey([time])).toBe('section.badge.conflict');
  });

  it('falls back to the time conflict badge for an empty list', () => {
    expect(conflictBadgeKey([])).toBe('section.badge.conflict');
  });
});
