import { describe, it, expect } from 'vitest';
import { loadFixture } from '../../../tests/support/fixtures';
import {
  validate,
  facultyListSchema,
  departmentListSchema,
  curriculumListSchema,
  subjectOwnerListSchema,
} from './schemas';

describe('validate', () => {
  it('returns ok with the parsed value on success', () => {
    const result = validate(
      facultyListSchema,
      loadFixture('faculty.capture.json'),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.length).toBeGreaterThan(0);
    }
  });

  it('returns a validation error with dotted issue paths on failure', () => {
    const result = validate(departmentListSchema, [{ faculty_id: 'x' }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('validation');
      expect(result.error.issues.length).toBeGreaterThan(0);
      expect(result.error.issues[0]?.path).toContain('0.department_id');
    }
  });
});

describe('reference schemas parse the real captures', () => {
  it('accepts the faculty capture including nullable acronym fields', () => {
    const result = validate(
      facultyListSchema,
      loadFixture('faculty.capture.json'),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.some((f) => f.ACRONYM_TH === null)).toBe(true);
    }
  });

  it('accepts the department capture', () => {
    expect(
      validate(departmentListSchema, loadFixture('department.capture.json')).ok,
    ).toBe(true);
  });

  it('accepts the curriculum capture with varying id widths and nullable period', () => {
    const result = validate(
      curriculumListSchema,
      loadFixture('curriculum.level1.capture.json'),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const widths = new Set(
        result.value.map((c) => c.REGISTRAR_CURRICULUM2_ID.length),
      );
      expect(widths.size).toBeGreaterThan(1);
    }
  });

  it('accepts the subject owner capture', () => {
    const result = validate(
      subjectOwnerListSchema,
      loadFixture('subject-owner.capture.json'),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(
        result.value.some((o) => o.TEACH_TABLE_SUBJECT_OWNER_ID === '32'),
      ).toBe(true);
    }
  });
});
