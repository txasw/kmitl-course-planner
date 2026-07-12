import { describe, it, expect } from 'vitest';
import {
  parseTeachTimeStr,
  TEACH_TIME_STR_PATTERN,
  TEACH_TIME_STR_SEGMENT,
} from './teachTimeStr';

describe('parseTeachTimeStr', () => {
  it('treats null, empty, and whitespace as no meetings without a fault', () => {
    expect(parseTeachTimeStr(null)).toEqual({ meetings: [], malformed: false });
    expect(parseTeachTimeStr('')).toEqual({ meetings: [], malformed: false });
    expect(parseTeachTimeStr('   ')).toEqual({
      meetings: [],
      malformed: false,
    });
  });

  it('parses one segment, mapping the day and the times to minutes', () => {
    // "5" is Thursday (day 4). This is the live QA case, subject 01476101/34.
    expect(parseTeachTimeStr('5x10:30-12:00')).toEqual({
      meetings: [{ day: 4, startMin: 630, endMin: 720 }],
      malformed: false,
    });
  });

  it('parses two comma separated segments on the same day', () => {
    expect(parseTeachTimeStr('1x13:00-16:00,1x16:30-19:30')).toEqual({
      meetings: [
        { day: 0, startMin: 780, endMin: 960 },
        { day: 0, startMin: 990, endMin: 1170 },
      ],
      malformed: false,
    });
  });

  it('keeps a segment day that differs from the primary teach_day', () => {
    // Real capture: a section whose primary is day 5 also meets on day 6.
    expect(parseTeachTimeStr('6x17:30-19:00')).toEqual({
      meetings: [{ day: 5, startMin: 1050, endMin: 1140 }],
      malformed: false,
    });
  });

  it('accepts a one digit hour', () => {
    expect(parseTeachTimeStr('2x9:00-10:00')).toEqual({
      meetings: [{ day: 1, startMin: 540, endMin: 600 }],
      malformed: false,
    });
  });

  it('rejects the Thai display variant as malformed with no meeting', () => {
    // "จ. 09:00-12:00" is a human display string, not the machine grammar. It
    // appears only in a hand made fixture and never in a real capture. The parser
    // rejects it so an invented shape can never masquerade as a meeting.
    expect(parseTeachTimeStr('จ. 09:00-12:00')).toEqual({
      meetings: [],
      malformed: true,
    });
  });

  it('keeps valid segments and flags malformed when one segment is bad', () => {
    const result = parseTeachTimeStr('5x10:30-12:00,garbage');
    expect(result.meetings).toEqual([{ day: 4, startMin: 630, endMin: 720 }]);
    expect(result.malformed).toBe(true);
  });

  it('rejects a segment whose end is not after its start', () => {
    expect(parseTeachTimeStr('5x12:00-12:00')).toEqual({
      meetings: [],
      malformed: true,
    });
    expect(parseTeachTimeStr('5x12:00-11:00')).toEqual({
      meetings: [],
      malformed: true,
    });
  });

  it('rejects an out of range hour or minute', () => {
    expect(parseTeachTimeStr('5x25:00-26:00')).toEqual({
      meetings: [],
      malformed: true,
    });
    expect(parseTeachTimeStr('5x10:60-11:00')).toEqual({
      meetings: [],
      malformed: true,
    });
  });

  it('rejects a day outside 1 through 7', () => {
    expect(parseTeachTimeStr('8x10:00-11:00')).toEqual({
      meetings: [],
      malformed: true,
    });
    expect(parseTeachTimeStr('0x10:00-11:00')).toEqual({
      meetings: [],
      malformed: true,
    });
  });
});

describe('TEACH_TIME_STR_PATTERN', () => {
  it('matches the empty string so most rows pass the auditor', () => {
    expect(TEACH_TIME_STR_PATTERN.test('')).toBe(true);
  });

  it('matches single and multi segment machine grammar', () => {
    expect(TEACH_TIME_STR_PATTERN.test('5x10:30-12:00')).toBe(true);
    expect(TEACH_TIME_STR_PATTERN.test('1x13:00-16:00,1x16:30-19:30')).toBe(
      true,
    );
  });

  it('rejects the Thai display variant and other drift', () => {
    expect(TEACH_TIME_STR_PATTERN.test('จ. 09:00-12:00')).toBe(false);
    expect(TEACH_TIME_STR_PATTERN.test('5x10:30-12:00,')).toBe(false);
    expect(TEACH_TIME_STR_PATTERN.test('8x10:00-11:00')).toBe(false);
  });
});

describe('TEACH_TIME_STR_SEGMENT', () => {
  it('captures the day and the four time digits', () => {
    const match = TEACH_TIME_STR_SEGMENT.exec('5x10:30-12:00');
    expect(match?.slice(1)).toEqual(['5', '10', '30', '12', '00']);
  });
});
