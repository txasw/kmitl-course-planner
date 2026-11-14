import { describe, expect, it } from 'vitest';
import { hoursText } from './hours';
import { createTranslator } from './t';

describe('hoursText', () => {
  it('sets the Thai unit apart with a space', () => {
    expect(hoursText(360, 'th', createTranslator('th'))).toBe('6 ชม.');
  });

  it('joins the English unit to the number', () => {
    expect(hoursText(360, 'en', createTranslator('en'))).toBe('6h');
  });

  it('keeps one decimal for a part hour', () => {
    expect(hoursText(90, 'th', createTranslator('th'))).toBe('1.5 ชม.');
    expect(hoursText(90, 'en', createTranslator('en'))).toBe('1.5h');
  });
});
