import { describe, expect, it } from 'vitest';
import { pickLocalized } from './localize';

describe('pickLocalized', () => {
  it('returns the primary language when it is present', () => {
    expect(pickLocalized('ไทย', 'English', 'th')).toBe('ไทย');
    expect(pickLocalized('ไทย', 'English', 'en')).toBe('English');
  });

  it('falls back to the other language when the primary is empty', () => {
    expect(pickLocalized('', 'English', 'th')).toBe('English');
    expect(pickLocalized('ไทย', '', 'en')).toBe('ไทย');
  });

  it('treats null and undefined as empty and falls back', () => {
    expect(pickLocalized(null, 'English', 'th')).toBe('English');
    expect(pickLocalized(undefined, 'ไทย', 'en')).toBe('ไทย');
  });

  it('returns an empty string when both are absent', () => {
    expect(pickLocalized(null, undefined, 'th')).toBe('');
  });
});
