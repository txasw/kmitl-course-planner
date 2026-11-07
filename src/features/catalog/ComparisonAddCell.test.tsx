import { describe, expect, it } from 'vitest';
import { createTranslator } from '@/lib/i18n/t';
import { makeSection } from '../../../tests/support/domain-builders';
import { addOutcomeText } from './ComparisonAddCell';

const t = createTranslator('th');
const section = makeSection({ subjectId: '90000001', section: '901' });

// The component tests drive a valid and a time conflicting add through the store; the
// outcomes the table cannot reach through its own controls are covered here.
describe('addOutcomeText', () => {
  it('names the section a valid add placed', () => {
    expect(
      addOutcomeText(
        { ok: true, result: { entries: [], added: [] } },
        section,
        t,
      ),
    ).toBe('เพิ่ม 90000001 กลุ่มเรียน 901 แล้ว');
  });

  it('names the other term for a cross term rejection', () => {
    expect(
      addOutcomeText(
        {
          ok: false,
          crossTerm: {
            planTerm: { year: '2569', semester: '2' },
            incomingTerm: { year: '2569', semester: '1' },
          },
        },
        section,
        t,
      ),
    ).toBe('คนละภาค');
  });

  it('says the section cannot be added when no conflict names a reason', () => {
    expect(addOutcomeText({ ok: false, conflicts: [] }, section, t)).toBe(
      'เพิ่มไม่ได้',
    );
  });
});
