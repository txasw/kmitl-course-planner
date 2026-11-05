import { describe, expect, it } from 'vitest';
import th from './th.json';
import en from './en.json';
import { fillTemplate, templateTokens } from './template';

describe('fillTemplate', () => {
  it('places each value by name', () => {
    expect(
      fillTemplate('ว่าง {remaining} จาก {limit}', {
        remaining: 12,
        limit: 45,
      }),
    ).toBe('ว่าง 12 จาก 45');
    expect(
      fillTemplate('{remaining} of {limit} open', { remaining: 12, limit: 45 }),
    ).toBe('12 of 45 open');
  });

  it('leaves a token with no value as written', () => {
    expect(fillTemplate('{remaining} of {limit}', { remaining: 3 })).toBe(
      '3 of {limit}',
    );
  });

  it('returns a template with no tokens unchanged', () => {
    expect(fillTemplate('ไม่จำกัดที่นั่ง', { remaining: 1 })).toBe(
      'ไม่จำกัดที่นั่ง',
    );
  });
});

describe('dictionary placeholders', () => {
  it('uses the same placeholder names in th and en for every key', () => {
    const english: Record<string, string> = en;
    for (const [key, value] of Object.entries(th)) {
      expect(templateTokens(english[key] ?? ''), key).toEqual(
        templateTokens(value),
      );
    }
  });
});
