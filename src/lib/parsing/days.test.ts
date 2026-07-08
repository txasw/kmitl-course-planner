import { describe, it, expect } from 'vitest';
import { loadFixture } from '../../../tests/support/fixtures';
import {
  DAY_MAP,
  parseTeachDay,
  isUnscheduledDay,
  UNSCHEDULED_DAY,
  type DayOfWeek,
} from './days';

const FRIDAY: DayOfWeek = 5;

interface RawRow {
  subject_id: string;
  section: string;
  teach_day: string;
  teach_time: string;
}

/** Flatten every section row out of a raw teach table response. */
function flattenRows(raw: unknown): RawRow[] {
  const rows: RawRow[] = [];
  for (const group of raw as { teachtable: { data: RawRow[] }[] }[]) {
    for (const block of group.teachtable) {
      rows.push(...block.data);
    }
  }
  return rows;
}

describe('DAY_MAP', () => {
  it('maps the full 1 through 7 range onto Sunday through Saturday', () => {
    expect([...DAY_MAP.entries()]).toEqual([
      ['1', 0],
      ['2', 1],
      ['3', 2],
      ['4', 3],
      ['5', 4],
      ['6', 5],
      ['7', 6],
    ]);
  });
});

describe('parseTeachDay', () => {
  it('parses in range digits', () => {
    expect(parseTeachDay('1')).toBe(0);
    expect(parseTeachDay('6')).toBe(FRIDAY);
    expect(parseTeachDay('7')).toBe(6);
  });

  it('rejects out of range and malformed values as null', () => {
    // 0 is the unscheduled sentinel, not a real day, so it too resolves to null.
    expect(parseTeachDay('0')).toBeNull();
    expect(parseTeachDay('8')).toBeNull();
    expect(parseTeachDay('')).toBeNull();
    expect(parseTeachDay('x')).toBeNull();
    // Guards against prototype keys leaking through the lookup.
    expect(parseTeachDay('toString')).toBeNull();
  });
});

describe('isUnscheduledDay', () => {
  it('recognizes the unscheduled sentinel and nothing else', () => {
    expect(UNSCHEDULED_DAY).toBe('0');
    expect(isUnscheduledDay('0')).toBe(true);
    expect(isUnscheduledDay('6')).toBe(false);
    expect(isUnscheduledDay('')).toBe(false);
  });
});

describe('empirical verification against captured data', () => {
  // The by_class capture holds the numeric teach_day; the owner-46 result
  // snapshot renders these same (subject_id, section) pairs under the Thai day
  // name for Friday at the same start time. The triple match pins teach_day "6"
  // to Friday and, with it, the whole 1=Sunday sequence.
  const anchors = [
    { subjectId: '90642033', section: '905' },
    { subjectId: '90642129', section: '902' },
    { subjectId: '90643016', section: '904' },
  ];

  const rows = flattenRows(loadFixture('teach-table.by_class.capture.json'));

  it('finds each Friday anchor with teach_day "6" at 13:00', () => {
    for (const anchor of anchors) {
      const row = rows.find(
        (r) =>
          r.subject_id === anchor.subjectId && r.section === anchor.section,
      );
      expect(
        row,
        `${anchor.subjectId}/${anchor.section} present in capture`,
      ).toBeDefined();
      expect(row?.teach_day).toBe('6');
      expect(row?.teach_time).toBe('13:00:00');
    }
  });

  it('resolves the anchor teach_day to Friday through DAY_MAP', () => {
    expect(parseTeachDay('6')).toBe(FRIDAY);
  });
});
