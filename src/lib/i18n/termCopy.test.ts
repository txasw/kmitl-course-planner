import { describe, expect, it } from 'vitest';
import type { Term } from '@/lib/routing/academicTerms';
import { createTranslator } from './t';
import { termMismatchText } from './termCopy';

const PLAN: Term = { year: '2569', semester: '1' };
const OTHER: Term = { year: '2569', semester: '2' };

describe('termMismatchText', () => {
  it('states a section from another term in one Thai sentence', () => {
    expect(
      termMismatchText(PLAN, OTHER, 'section', createTranslator('th')),
    ).toBe(
      'ตารางนี้เป็นภาคการศึกษา 1/2569 แต่กลุ่มเรียนนี้อยู่ในภาคการศึกษา 2/2569',
    );
  });

  it('states a browsed term in one English sentence', () => {
    expect(
      termMismatchText(PLAN, OTHER, 'browsing', createTranslator('en')),
    ).toBe(
      'This plan is for semester 1/2569, but you are viewing semester 2/2569',
    );
  });

  it('fills every placeholder in both locales', () => {
    for (const locale of ['th', 'en'] as const) {
      const t = createTranslator(locale);
      for (const subject of ['section', 'browsing'] as const) {
        expect(termMismatchText(PLAN, OTHER, subject, t)).not.toMatch(/[{}]/);
      }
    }
  });
});
