import { describe, expect, it } from 'vitest';
import {
  COURSE_UNIT,
  CREDIT_UNIT,
  MERGED_UNIT,
  MORE_CONFLICT_UNIT,
  MULTI_MEETING_UNIT,
  SECTION_UNIT,
  SUBJECT_UNIT,
  countWithUnit,
  courseCountLabel,
  sectionCountLabel,
  unitWord,
} from './counts';
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

describe('count units', () => {
  const en = createTranslator('en');
  const th = createTranslator('th');

  it('uses the English singular unit for exactly one', () => {
    expect(countWithUnit(en, 1, CREDIT_UNIT)).toBe('1 credit');
    expect(countWithUnit(en, 1, SUBJECT_UNIT)).toBe('1 subject');
    expect(countWithUnit(en, 1, COURSE_UNIT)).toBe('1 course');
    expect(countWithUnit(en, 1, SECTION_UNIT)).toBe('1 section');
    expect(countWithUnit(en, 1, MERGED_UNIT)).toBe('1 merged duplicate');
    expect(countWithUnit(en, 1, MULTI_MEETING_UNIT)).toBe(
      '1 multi meeting section',
    );
    expect(countWithUnit(en, 1, MORE_CONFLICT_UNIT)).toBe('1 more conflict');
  });

  it('uses the English plural unit for zero, a fraction, and many', () => {
    expect(countWithUnit(en, 0, CREDIT_UNIT)).toBe('0 credits');
    expect(countWithUnit(en, 1.5, CREDIT_UNIT)).toBe('1.5 credits');
    expect(countWithUnit(en, 21, CREDIT_UNIT)).toBe('21 credits');
    expect(unitWord(en, 4, SUBJECT_UNIT)).toBe('subjects');
  });

  it('reads the same Thai unit for one and many', () => {
    expect(countWithUnit(th, 1, CREDIT_UNIT)).toBe('1 หน่วยกิต');
    expect(countWithUnit(th, 3, CREDIT_UNIT)).toBe('3 หน่วยกิต');
    expect(unitWord(th, 1, SUBJECT_UNIT)).toBe(unitWord(th, 2, SUBJECT_UNIT));
  });
});
