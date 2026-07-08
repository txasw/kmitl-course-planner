import { describe, it, expect } from 'vitest';
import { formatMinutes, parseTimeToMinutes } from './time';

describe('parseTimeToMinutes', () => {
  it('converts well formed times to minutes since midnight', () => {
    expect(parseTimeToMinutes('00:00:00')).toBe(0);
    expect(parseTimeToMinutes('09:00:00')).toBe(540);
    expect(parseTimeToMinutes('13:30:00')).toBe(810);
    expect(parseTimeToMinutes('23:59:00')).toBe(1439);
  });

  it('ignores seconds but validates their range', () => {
    expect(parseTimeToMinutes('10:15:30')).toBe(615);
    expect(parseTimeToMinutes('10:15:99')).toBeNull();
  });

  it('rejects malformed or out of range values', () => {
    expect(parseTimeToMinutes('9:00:00')).toBeNull();
    expect(parseTimeToMinutes('09:00')).toBeNull();
    expect(parseTimeToMinutes('')).toBeNull();
    expect(parseTimeToMinutes('25:00:00')).toBeNull();
    expect(parseTimeToMinutes('09:60:00')).toBeNull();
    expect(parseTimeToMinutes('ab:cd:ef')).toBeNull();
  });
});

describe('formatMinutes', () => {
  it('formats minutes since midnight as zero padded HH:MM', () => {
    expect(formatMinutes(0)).toBe('00:00');
    expect(formatMinutes(540)).toBe('09:00');
    expect(formatMinutes(810)).toBe('13:30');
    expect(formatMinutes(1439)).toBe('23:59');
  });
});
