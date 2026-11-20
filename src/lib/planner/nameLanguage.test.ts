import { describe, expect, it } from 'vitest';
import { effectiveNameLanguage, subjectNameLines } from './nameLanguage';

const physics = { nameTh: 'ฟิสิกส์ทั่วไป 1', nameEn: 'GENERAL PHYSICS 1' };

describe('effectiveNameLanguage', () => {
  it('follows the panel language while the choice is unset', () => {
    expect(effectiveNameLanguage(undefined, 'th')).toBe('th');
    expect(effectiveNameLanguage(undefined, 'en')).toBe('en');
  });

  it('keeps an explicit choice whatever the panel language', () => {
    expect(effectiveNameLanguage('en', 'th')).toBe('en');
    expect(effectiveNameLanguage('both', 'en')).toBe('both');
  });
});

describe('subjectNameLines', () => {
  it('names a subject in the panel language by default with no second line', () => {
    expect(subjectNameLines(physics, undefined, 'th')).toEqual({
      primary: 'ฟิสิกส์ทั่วไป 1',
      primaryLang: 'th',
      secondary: null,
      secondaryLang: null,
    });
    expect(subjectNameLines(physics, undefined, 'en').primary).toBe(
      'GENERAL PHYSICS 1',
    );
  });

  it('names a subject in the chosen language under either panel language', () => {
    for (const panel of ['th', 'en'] as const) {
      expect(subjectNameLines(physics, 'en', panel)).toMatchObject({
        primary: 'GENERAL PHYSICS 1',
        primaryLang: 'en',
        secondary: null,
      });
      expect(subjectNameLines(physics, 'th', panel)).toMatchObject({
        primary: 'ฟิสิกส์ทั่วไป 1',
        primaryLang: 'th',
        secondary: null,
      });
    }
  });

  it('leads with the panel language and adds the other as a second line for both', () => {
    expect(subjectNameLines(physics, 'both', 'th')).toEqual({
      primary: 'ฟิสิกส์ทั่วไป 1',
      primaryLang: 'th',
      secondary: 'GENERAL PHYSICS 1',
      secondaryLang: 'en',
    });
    expect(subjectNameLines(physics, 'both', 'en')).toEqual({
      primary: 'GENERAL PHYSICS 1',
      primaryLang: 'en',
      secondary: 'ฟิสิกส์ทั่วไป 1',
      secondaryLang: 'th',
    });
  });

  it('falls back to the other language when the chosen name is empty', () => {
    const thaiOnly = { nameTh: 'สัมมนา', nameEn: '' };
    expect(subjectNameLines(thaiOnly, 'en', 'th')).toEqual({
      primary: 'สัมมนา',
      primaryLang: 'th',
      secondary: null,
      secondaryLang: null,
    });
    expect(subjectNameLines(thaiOnly, 'both', 'th').secondary).toBeNull();
  });

  it('adds no second line that repeats the first', () => {
    const same = { nameTh: 'PROJECT', nameEn: 'PROJECT' };
    expect(subjectNameLines(same, 'both', 'th').secondary).toBeNull();
  });
});
