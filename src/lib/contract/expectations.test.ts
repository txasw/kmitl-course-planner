import { describe, it, expect } from 'vitest';
import {
  DEBUG_CANARY,
  SECTION_ROW_EXPECTATIONS,
  SECTION_ROW_FIELDS,
  CROSS_FIELD_RULES,
} from './expectations';

function rule(id: string) {
  const found = CROSS_FIELD_RULES.find((r) => r.id === id);
  if (found === undefined) {
    throw new Error(`missing cross field rule ${id}`);
  }
  return found;
}

describe('expectation table', () => {
  it('embeds the debug canary', () => {
    expect(DEBUG_CANARY).toBe('kcp-debug-canary');
  });

  it('covers all 34 section row fields with unique names', () => {
    expect(SECTION_ROW_EXPECTATIONS).toHaveLength(34);
    expect(SECTION_ROW_FIELDS.size).toBe(34);
    expect(SECTION_ROW_FIELDS.has('teach_time2')).toBe(true);
    expect(SECTION_ROW_FIELDS.has('count')).toBe(true);
  });

  it('audits teachtime_str against the machine grammar at warn severity', () => {
    const expectation = SECTION_ROW_EXPECTATIONS.find(
      (candidate) => candidate.field === 'teachtime_str',
    );
    expect(expectation?.severity).toBe('warn');
    expect(expectation?.pattern?.test('')).toBe(true);
    expect(expectation?.pattern?.test('5x10:30-12:00')).toBe(true);
    expect(expectation?.pattern?.test('จ. 09:00-12:00')).toBe(false);
  });
});

describe('end_after_start rule', () => {
  function check(row: Record<string, unknown>): string | null {
    return rule('end_after_start').check(row, []);
  }

  it('passes when the end is after the start', () => {
    expect(
      check({ teach_time: '09:00:00', teach_time2: '12:00:00' }),
    ).toBeNull();
  });

  it('flags an end at or before the start', () => {
    expect(check({ teach_time: '12:00:00', teach_time2: '09:00:00' })).toBe(
      '12:00:00 to 09:00:00',
    );
    expect(
      check({ teach_time: '09:00:00', teach_time2: '09:00:00' }),
    ).not.toBeNull();
  });

  it('ignores unparseable times, which the field checks catch', () => {
    expect(check({ teach_time: 'bad', teach_time2: '12:00:00' })).toBeNull();
  });
});

describe('sec_pair_resolves rule', () => {
  function check(
    row: Record<string, unknown>,
    allRows: Record<string, unknown>[],
  ): string | null {
    return rule('sec_pair_resolves').check(row, allRows);
  }

  it('passes when the paired section exists for the same subject', () => {
    const lecture: Record<string, unknown> = {
      subject_id: 'X',
      section: '901',
      sec_pair: '902',
    };
    const practice: Record<string, unknown> = {
      subject_id: 'X',
      section: '902',
      sec_pair: '901',
    };
    expect(check(lecture, [lecture, practice])).toBeNull();
  });

  it('flags a sec_pair with no matching section', () => {
    const orphan: Record<string, unknown> = {
      subject_id: 'X',
      section: '901',
      sec_pair: '999',
    };
    expect(check(orphan, [orphan])).toBe(
      'sec_pair "999" has no matching section',
    );
  });

  it('ignores a null sec_pair', () => {
    const standalone: Record<string, unknown> = {
      subject_id: 'X',
      section: '901',
      sec_pair: null,
    };
    expect(check(standalone, [standalone])).toBeNull();
  });
});
