import { describe, it, expect } from 'vitest';
import { loadFixture } from '../../../tests/support/fixtures';
import {
  validate,
  teachTableResponseSchema,
  sectionRowSchema,
  FULL_MARKER,
  type RawSectionRow,
} from './schemas';

const CAPTURES = [
  'teach-table.by_class.capture.json',
  'teach-table.by_subject_id.capture.json',
  'teach-table.by_subject_owner_id-32.capture.json',
];

function allRows(name: string): RawSectionRow[] {
  const result = validate(teachTableResponseSchema, loadFixture(name));
  if (!result.ok) {
    throw new Error(`fixture ${name} failed validation`);
  }
  return result.value.flatMap((group) =>
    group.teachtable.flatMap((block) => block.data),
  );
}

describe('teach table schema parses every capture', () => {
  it.each(CAPTURES)('accepts %s', (name) => {
    expect(validate(teachTableResponseSchema, loadFixture(name)).ok).toBe(true);
  });
});

describe('teach table schema honours the documented quirks', () => {
  it('accepts the count union as both a number and the full marker', () => {
    const rows = allRows('teach-table.by_subject_owner_id-32.capture.json');
    expect(rows.some((r) => typeof r.count === 'number')).toBe(true);
    expect(rows.some((r) => r.count === FULL_MARKER)).toBe(true);
  });

  it('accepts non null sec_pair and the x grouping sentinel', () => {
    const result = validate(
      teachTableResponseSchema,
      loadFixture('teach-table.by_subject_owner_id-32.capture.json'),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.some((g) => g.department_id === 'x')).toBe(true);
      expect(result.value.some((g) => g.department_name_th === null)).toBe(
        true,
      );
      const rows = result.value.flatMap((g) =>
        g.teachtable.flatMap((b) => b.data),
      );
      expect(rows.some((r) => r.sec_pair !== null)).toBe(true);
    }
  });

  it('accepts the literal dash for an uncapped limit', () => {
    const rows = allRows('teach-table.by_class.capture.json');
    expect(rows.some((r) => r.limit === '-')).toBe(true);
  });
});

describe('teach table schema rejects drift', () => {
  const base = allRows('teach-table.by_subject_owner_id-32.capture.json')[0];
  if (base === undefined) {
    throw new Error('owner capture unexpectedly has no rows');
  }

  it('rejects a count string other than the full marker', () => {
    expect(sectionRowSchema.safeParse({ ...base, count: 'Full' }).success).toBe(
      false,
    );
  });

  it('rejects a missing required field', () => {
    const rest: Record<string, unknown> = { ...base };
    delete rest.teach_time;
    expect(sectionRowSchema.safeParse(rest).success).toBe(false);
  });
});
