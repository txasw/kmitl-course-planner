import { describe, expect, it } from 'vitest';
import { pickLocalized, pickLocalizedWithLang } from './localize';

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

describe('pickLocalizedWithLang', () => {
  it('returns the primary value with the locale as its language', () => {
    expect(pickLocalizedWithLang('ไทย', 'English', 'th')).toEqual({
      value: 'ไทย',
      lang: 'th',
    });
    expect(pickLocalizedWithLang(['A'], ['B'], 'en')).toEqual({
      value: ['B'],
      lang: 'en',
    });
  });

  it('falls back to the other field and reports its language', () => {
    expect(pickLocalizedWithLang('', 'English', 'th')).toEqual({
      value: 'English',
      lang: 'en',
    });
    expect(pickLocalizedWithLang(['ไทย'], [], 'en')).toEqual({
      value: ['ไทย'],
      lang: 'th',
    });
  });

  it('keeps the locale as the language when both fields are empty', () => {
    expect(pickLocalizedWithLang('', '', 'th')).toEqual({
      value: '',
      lang: 'th',
    });
  });
});
