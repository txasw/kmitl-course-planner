import { describe, expect, it } from 'vitest';
import { conditionLines, textLines } from './conditions';

describe('textLines', () => {
  it('splits on newlines and drops blank and padded entries', () => {
    expect(textLines(' เฉพาะชั้นปี 1 \n\n  \nเฉพาะหลักสูตรนานาชาติ')).toEqual([
      'เฉพาะชั้นปี 1',
      'เฉพาะหลักสูตรนานาชาติ',
    ]);
  });

  it('returns no lines for an empty field', () => {
    expect(textLines('')).toEqual([]);
  });
});

describe('conditionLines', () => {
  it('reads the locale primary rules with their language', () => {
    expect(conditionLines('เฉพาะคณะ\nเฉพาะสาขา', 'Only faculty', 'th')).toEqual(
      { value: ['เฉพาะคณะ', 'เฉพาะสาขา'], lang: 'th' },
    );
    expect(conditionLines('เฉพาะคณะ', 'Only faculty', 'en')).toEqual({
      value: ['Only faculty'],
      lang: 'en',
    });
  });

  it('falls back to the other language when the primary has no rules', () => {
    expect(conditionLines('เฉพาะคณะ', '', 'en')).toEqual({
      value: ['เฉพาะคณะ'],
      lang: 'th',
    });
    expect(conditionLines('\n', 'Only faculty', 'th')).toEqual({
      value: ['Only faculty'],
      lang: 'en',
    });
  });

  it('keeps angle bracket qualifiers as text', () => {
    expect(
      conditionLines('', 'Only AI <Dual Degree> <International Program>', 'th')
        .value,
    ).toEqual(['Only AI <Dual Degree> <International Program>']);
  });
});
