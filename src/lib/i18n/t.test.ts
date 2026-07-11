import { describe, it, expect } from 'vitest';
import th from './th.json';
import en from './en.json';
import { createTranslator, DEFAULT_LOCALE } from './t';

describe('i18n dictionaries', () => {
  it('th and en expose identical key sets', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(th).sort());
  });

  it('defaults to Thai per the brief', () => {
    expect(DEFAULT_LOCALE).toBe('th');
  });

  it('resolves a key in each locale', () => {
    expect(createTranslator('th')('launcher.open')).toBe(
      'เปิด Course Planner for KMITL',
    );
    expect(createTranslator('en')('launcher.open')).toBe(
      'Open Course Planner for KMITL',
    );
  });
});
