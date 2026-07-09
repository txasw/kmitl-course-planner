import { describe, it, expect } from 'vitest';
import { createTranslator } from '@/lib/i18n/t';
import type { EntryDiff } from '@/lib/planner/revalidate';
import {
  makeMeeting,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import { describeEntryDiff } from './describeEntryDiff';

const t = createTranslator('en');

function makeDiff(overrides: Partial<EntryDiff> = {}): EntryDiff {
  const before = makeSnapshot();
  return {
    teachTableId: before.teachTableId,
    subjectId: before.subjectId,
    section: before.section,
    outcome: 'changed',
    changes: [],
    before,
    after: makeSnapshot(),
    ...overrides,
  };
}

describe('describeEntryDiff', () => {
  it('returns no rows for a missing entry with no fresh snapshot', () => {
    const diff = makeDiff({ outcome: 'missing', changes: [], after: null });
    expect(describeEntryDiff(diff, 'en', t)).toEqual([]);
  });

  it('returns no rows when nothing changed', () => {
    expect(describeEntryDiff(makeDiff({ changes: [] }), 'en', t)).toEqual([]);
  });

  it('formats a time change with old and new meeting times', () => {
    const diff = makeDiff({
      changes: ['time_changed'],
      before: makeSnapshot({ meetings: [makeMeeting({ startMin: 540 })] }),
      after: makeSnapshot({ meetings: [makeMeeting({ startMin: 600 })] }),
    });
    const rows = describeEntryDiff(diff, 'en', t);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.label).toBe(t('diff.time'));
    expect(rows[0]?.old).toContain('09:00');
    expect(rows[0]?.next).toContain('10:00');
  });

  it('formats a room change', () => {
    const diff = makeDiff({
      changes: ['room_changed'],
      before: makeSnapshot({ meetings: [makeMeeting({ room: 'A101' })] }),
      after: makeSnapshot({ meetings: [makeMeeting({ room: 'B202' })] }),
    });
    const rows = describeEntryDiff(diff, 'en', t);
    expect(rows[0]?.label).toBe(t('diff.room'));
    expect(rows[0]?.old).toContain('A101');
    expect(rows[0]?.next).toContain('B202');
  });

  it('formats a teacher change in the active locale', () => {
    const diff = makeDiff({
      changes: ['teacher_changed'],
      before: makeSnapshot({ teachersEn: ['Somchai'] }),
      after: makeSnapshot({ teachersEn: ['Somsri'] }),
    });
    const rows = describeEntryDiff(diff, 'en', t);
    expect(rows[0]?.old).toBe('Somchai');
    expect(rows[0]?.next).toBe('Somsri');
  });

  it('formats a seat change', () => {
    const diff = makeDiff({
      changes: ['seats_changed'],
      before: makeSnapshot({
        seats: { limit: 40, preCount: 0, queueLeft: 40, enrolled: 10 },
      }),
      after: makeSnapshot({
        seats: { limit: 40, preCount: 0, queueLeft: 0, enrolled: 'full' },
      }),
    });
    const rows = describeEntryDiff(diff, 'en', t);
    expect(rows[0]?.label).toBe(t('diff.seats'));
    expect(rows[0]?.old).toBe('10/40');
    expect(rows[0]?.next).toBe(t('seat.full'));
  });

  it('produces one row per changed field, preserving order', () => {
    const diff = makeDiff({ changes: ['time_changed', 'room_changed'] });
    const rows = describeEntryDiff(diff, 'en', t);
    expect(rows.map((row) => row.label)).toEqual([
      t('diff.time'),
      t('diff.room'),
    ]);
  });
});
