import { describe, expect, it } from 'vitest';
import { courseCountLabel, sectionCountLabel } from './counts';
import { createTranslator } from './t';

describe('count labels', () => {
  const en = createTranslator('en');
  const th = createTranslator('th');

  it('uses the English singular for one', () => {
    expect(courseCountLabel(en, 1)).toBe('1 course');
    expect(sectionCountLabel(en, 1)).toBe('1 section');
  });

  it('uses the English plural otherwise', () => {
    expect(courseCountLabel(en, 0)).toBe('0 courses');
    expect(courseCountLabel(en, 3)).toBe('3 courses');
    expect(sectionCountLabel(en, 12)).toBe('12 sections');
  });

  it('reads the same in Thai for one and many', () => {
    expect(courseCountLabel(th, 1)).toBe('1 รายวิชา');
    expect(sectionCountLabel(th, 5)).toBe('5 กลุ่มเรียน');
  });
});
