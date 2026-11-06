import { describe, it, expect } from 'vitest';
import type { DayOfWeek } from '../parsing/days';
import { makeMeeting } from '../../../tests/support/domain-builders';
import {
  LONG_GAP_MIN,
  WORKING_DAYS,
  computeFreePeriods,
  type MeetingSpan,
} from './freePeriods';

function span(day: DayOfWeek, start: string, end: string): MeetingSpan {
  const minutes = (clock: string): number => {
    const [hours = '0', mins = '0'] = clock.split(':');
    return Number(hours) * 60 + Number(mins);
  };
  return { day, startMin: minutes(start), endMin: minutes(end) };
}

describe('computeFreePeriods', () => {
  it('reads every working day as free and finds no gap in an empty plan', () => {
    expect(computeFreePeriods([])).toEqual({
      freeDays: WORKING_DAYS,
      gaps: [],
    });
  });

  it('lists the working days with no meeting, Monday first', () => {
    const result = computeFreePeriods([
      span(4, '09:00', '12:00'),
      span(1, '13:00', '16:00'),
      span(2, '09:00', '10:30'),
    ]);
    expect(result.freeDays).toEqual([3, 5]);
  });

  it('never lists a weekend day as free, and a weekend meeting frees no weekday', () => {
    const result = computeFreePeriods([span(6, '09:00', '12:00')]);
    expect(result.freeDays).toEqual([1, 2, 3, 4, 5]);
  });

  it('counts a break of exactly three hours as a long gap', () => {
    const result = computeFreePeriods([
      span(4, '08:00', '10:00'),
      span(4, '13:00', '16:00'),
    ]);
    expect(LONG_GAP_MIN).toBe(180);
    expect(result.gaps).toEqual([span(4, '10:00', '13:00')]);
  });

  it('ignores a break one minute short of three hours', () => {
    const result = computeFreePeriods([
      span(4, '08:00', '10:01'),
      span(4, '13:00', '16:00'),
    ]);
    expect(result.gaps).toEqual([]);
  });

  it('does not count the time before the first class or after the last', () => {
    const result = computeFreePeriods([span(2, '13:00', '14:00')]);
    expect(result.gaps).toEqual([]);
  });

  it('merges overlapping and touching meetings before measuring the gap', () => {
    const result = computeFreePeriods([
      span(1, '09:00', '11:00'),
      span(1, '10:00', '12:00'),
      span(1, '12:00', '12:30'),
      span(1, '08:00', '09:30'),
      span(1, '16:00', '17:00'),
    ]);
    expect(result.gaps).toEqual([span(1, '12:30', '16:00')]);
  });

  it('does not let a short meeting inside a long one split it into a gap', () => {
    const result = computeFreePeriods([
      span(3, '08:00', '17:00'),
      span(3, '09:00', '10:00'),
      span(3, '20:00', '21:00'),
    ]);
    expect(result.gaps).toEqual([span(3, '17:00', '20:00')]);
  });

  it('orders gaps Sunday through Saturday, then by start, whatever the input order', () => {
    const result = computeFreePeriods([
      span(5, '16:00', '18:00'),
      span(5, '08:00', '09:00'),
      span(5, '12:00', '13:00'),
      span(0, '08:00', '09:00'),
      span(0, '13:00', '14:00'),
    ]);
    expect(result.gaps).toEqual([
      span(0, '09:00', '13:00'),
      span(5, '09:00', '12:00'),
      span(5, '13:00', '16:00'),
    ]);
  });

  it('accepts full meetings and leaves the input untouched', () => {
    const meetings = [
      makeMeeting({ day: 2, startMin: 480, endMin: 600 }),
      makeMeeting({ day: 2, startMin: 540, endMin: 660 }),
      makeMeeting({ day: 2, startMin: 900, endMin: 960 }),
    ];
    const before = structuredClone(meetings);
    const result = computeFreePeriods(meetings);
    expect(result.gaps).toEqual([{ day: 2, startMin: 660, endMin: 900 }]);
    expect(result.freeDays).toEqual([1, 3, 4, 5]);
    expect(meetings).toEqual(before);
  });
});
