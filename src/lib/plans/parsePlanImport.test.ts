import { describe, it, expect } from 'vitest';
import {
  makePlan,
  makePlanEntry,
} from '../../../tests/support/domain-builders';
import { createTranslator } from '@/lib/i18n/t';
import { parsePlanImport } from './parsePlanImport';

const th = createTranslator('th');
const en = createTranslator('en');

/** Parse text expected to be rejected and return its messages. */
function rejectionOf(text: string, t = en): string[] {
  const result = parsePlanImport(text, t);
  if (result.ok) {
    throw new Error('expected the import to be rejected');
  }
  return result.error;
}

describe('parsePlanImport', () => {
  it('accepts a valid plan and returns it unchanged', () => {
    const plan = makePlan();
    const result = parsePlanImport(JSON.stringify(plan), en);
    expect(result).toEqual({ ok: true, value: plan });
  });

  it('rejects text that is not JSON with a single localized message', () => {
    expect(rejectionOf('{"id":', en)).toEqual(['The file is not valid JSON']);
    expect(rejectionOf('not json', th)).toEqual(['ไฟล์ไม่ใช่ JSON ที่ถูกต้อง']);
  });

  it('lists every missing field of a truncated plan', () => {
    const messages = rejectionOf('{"id":"x","name":"x"}');
    expect(messages).toEqual(
      expect.arrayContaining([
        'year: Missing',
        'semester: Missing',
        'entries: Missing',
        'createdAt: Missing',
        'updatedAt: Missing',
      ]),
    );
  });

  it('names a tampered enum value with its path in the active locale', () => {
    const text = JSON.stringify({
      ...makePlan({ entries: [] }),
      semester: '9',
    });
    expect(rejectionOf(text, th)).toEqual([
      'semester: ค่าไม่อยู่ในตัวเลือกที่รองรับ',
    ]);
    for (const message of rejectionOf(text, en)) {
      expect(message).not.toMatch(/Invalid option|expected one of/i);
    }
  });

  it('names a tampered nested field by its full path', () => {
    const entry = makePlanEntry();
    const tampered = {
      ...makePlan({ entries: [] }),
      entries: [{ ...entry, snapshot: { ...entry.snapshot, meetings: 'x' } }],
    };
    expect(rejectionOf(JSON.stringify(tampered))).toEqual([
      'entries.0.snapshot.meetings: Wrong type',
    ]);
  });

  it('rejects an entry whose term differs from the plan term', () => {
    const plan = makePlan({
      entries: [
        makePlanEntry({
          sourceQuery: {
            endpoint: 'get-teach-table-show',
            params: {
              mode: 'by_class',
              selected_year: '2570',
              selected_semester: '1',
            },
          },
        }),
      ],
    });
    expect(rejectionOf(JSON.stringify(plan))).toEqual([
      'entries.0.sourceQuery: Entry term does not match the plan',
    ]);
  });

  it('rejects a JSON value that is not a plan object', () => {
    expect(rejectionOf('[]')).toEqual(['Wrong type']);
    expect(rejectionOf('null')).toEqual(['Wrong type']);
  });

  it('drops review and notification state carried from another device', () => {
    const plan = makePlan();
    const blob = {
      ...plan,
      notifiedAt: '2026-07-08T00:00:00.000Z',
      entries: plan.entries.map((entry) => ({
        ...entry,
        review: { kinds: ['time_changed'] },
        notifiedAt: '2026-07-08T00:00:00.000Z',
      })),
    };
    const result = parsePlanImport(JSON.stringify(blob), en);
    if (!result.ok) {
      throw new Error('expected the import to succeed');
    }
    expect(result.value).not.toHaveProperty('notifiedAt');
    for (const entry of result.value.entries) {
      expect(entry).not.toHaveProperty('review');
      expect(entry).not.toHaveProperty('notifiedAt');
    }
    expect(result.value).toEqual(plan);
  });
});
