import { describe, expect, it } from 'vitest';
import { curriculumProfileSchema } from './curriculumProfile';

const profile = {
  facultyId: '01',
  departmentId: '05',
  curriculumId: '137',
  classYear: '1',
};

describe('curriculumProfileSchema', () => {
  it('accepts one real grouping', () => {
    expect(curriculumProfileSchema.safeParse(profile).success).toBe(true);
  });

  it('refuses the all values of the data and of the search form', () => {
    for (const curriculumId of ['x', 'all', '']) {
      expect(
        curriculumProfileSchema.safeParse({ ...profile, curriculumId }).success,
      ).toBe(false);
    }
    expect(
      curriculumProfileSchema.safeParse({ ...profile, departmentId: 'x' })
        .success,
    ).toBe(false);
  });

  it('accepts class years 1 through 8 only', () => {
    for (const classYear of ['0', 'all', '9', '']) {
      expect(
        curriculumProfileSchema.safeParse({ ...profile, classYear }).success,
      ).toBe(false);
    }
    expect(
      curriculumProfileSchema.safeParse({ ...profile, classYear: '8' }).success,
    ).toBe(true);
  });
});
