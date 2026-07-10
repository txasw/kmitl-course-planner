import { describe, it, expect } from 'vitest';
import {
  makePlan,
  makePlanEntry,
} from '../../../tests/support/domain-builders';
import { createTranslator } from '@/lib/i18n/t';
import { planSchema } from './plan';
import { importIssueMessages } from './importIssues';

const t = createTranslator('en');

/** Parse a blob expected to fail and return the localized issue messages. */
function messagesFor(blob: unknown): string[] {
  const result = planSchema.safeParse(blob);
  if (result.success) {
    throw new Error('expected the blob to fail validation');
  }
  return importIssueMessages(result.error, blob, t);
}

describe('importIssueMessages', () => {
  it('names a missing field with its path and drops the library phrasing', () => {
    const messages = messagesFor({ id: 'x', name: 'x' });
    expect(messages).toContain('year: Missing');
    expect(messages).toContain('entries: Missing');
    for (const message of messages) {
      expect(message).not.toContain('Invalid input');
      expect(message).not.toContain('received undefined');
    }
  });

  it('reads a wrong typed field as wrong type, not missing', () => {
    const messages = messagesFor({
      id: 'x',
      name: 'x',
      year: 2569,
      semester: '1',
      entries: [],
      createdAt: 'a',
      updatedAt: 'a',
    });
    expect(messages).toEqual(['year: Wrong type']);
  });

  it('reads a value outside an enum as not allowed', () => {
    const messages = messagesFor({
      id: 'x',
      name: 'x',
      year: '2569',
      semester: '9',
      entries: [],
      createdAt: 'a',
      updatedAt: 'a',
    });
    expect(messages).toEqual(['semester: Value not allowed']);
  });

  it('reads the term invariant refine as a term mismatch', () => {
    const plan = makePlan({
      year: '2569',
      semester: '1',
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
    expect(messagesFor(plan)).toEqual([
      'entries.0.sourceQuery: Entry term does not match the plan',
    ]);
  });
});
