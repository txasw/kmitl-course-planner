import { describe, it, expect } from 'vitest';
import { loadFixture } from '../../../tests/support/fixtures';
import {
  validate,
  facultyListSchema,
  departmentListSchema,
  curriculumListSchema,
  subjectOwnerListSchema,
  currentTermSchema,
  toCurrentTerm,
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

describe('current term schema', () => {
  const capture = loadFixture('year-semester-now.capture.json');

  it('accepts the capture and normalizes it to a term', () => {
    const result = validate(currentTermSchema, capture);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(toCurrentTerm(result.value)).toEqual({
        year: '2569',
        semester: '1',
      });
    }
  });

  it('accepts a response whose datetime fields are null or absent', () => {
    expect(
      validate(currentTermSchema, {
        YEAR: '2569',
        SEMESTER: '2',
        START_DATETIME_SYSTEM: null,
      }).ok,
    ).toBe(true);
  });

  it('rejects a response missing YEAR', () => {
    const result = validate(currentTermSchema, { SEMESTER: '1' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.issues[0]?.path).toBe('YEAR');
    }
  });

  it('rejects a semester outside 1 to 3 and a year that is not 4 digits', () => {
    const badSemester = validate(currentTermSchema, {
      YEAR: '2569',
      SEMESTER: '9',
    });
    expect(badSemester.ok).toBe(false);
    if (!badSemester.ok) {
      expect(badSemester.error.issues[0]?.path).toBe('SEMESTER');
    }
    expect(validate(currentTermSchema, { YEAR: '69', SEMESTER: '1' }).ok).toBe(
      false,
    );
  });

  it('rejects an array where the single object is expected', () => {
    expect(validate(currentTermSchema, [capture]).ok).toBe(false);
  });
});
