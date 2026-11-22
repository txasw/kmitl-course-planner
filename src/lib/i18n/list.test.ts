import { describe, expect, it } from 'vitest';
import { createTranslator } from './t';
import { joinList, sectionCodesLabel } from './list';

const th = createTranslator('th');
const en = createTranslator('en');

describe('joinList', () => {
  it('joins a pair with the conjunction of the locale, spaced in Thai too', () => {
    expect(joinList(en, ['34', '35'])).toBe('34 and 35');
    expect(joinList(th, ['34', '35'])).toBe('34 และ 35');
  });

  it('joins a longer list as a series', () => {
    expect(joinList(en, ['34', '35', '36'])).toBe('34, 35, and 36');
    expect(joinList(th, ['34', '35', '36'])).toBe('34 35 และ 36');
  });

  it('keeps one value and an empty list as they are', () => {
    expect(joinList(en, ['34'])).toBe('34');
    expect(joinList(en, [])).toBe('');
  });
});

describe('sectionCodesLabel', () => {
  it('names one section in the singular and a pair in the plural', () => {
    expect(sectionCodesLabel(en, ['34'])).toBe('Section 34');
    expect(sectionCodesLabel(en, ['34', '35'])).toBe('Sections 34 and 35');
  });

  it('keeps the one Thai noun for any count', () => {
    expect(sectionCodesLabel(th, ['34'])).toBe('กลุ่มเรียน 34');
    expect(sectionCodesLabel(th, ['34', '35'])).toBe('กลุ่มเรียน 34 และ 35');
  });
});
