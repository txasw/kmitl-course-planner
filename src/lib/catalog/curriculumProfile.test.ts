import { describe, expect, it } from 'vitest';
import {
  curriculumProfileSchema,
  profileDraft,
  profileFromSelection,
} from './curriculumProfile';

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

describe('profileDraft', () => {
  it('opens on the class search with its all options cleared', () => {
    expect(
      profileDraft(null, {
        faculty: '01',
        department: '05',
        curriculum: 'all',
        classYear: 'all',
      }),
    ).toEqual({
      faculty: '01',
      department: '05',
      curriculum: '',
      classYear: '',
    });
    expect(
      profileDraft(null, {
        faculty: '01',
        department: '05',
        curriculum: '137',
        classYear: '2',
      }),
    ).toEqual({
      faculty: '01',
      department: '05',
      curriculum: '137',
      classYear: '2',
    });
  });

  it('opens on the saved profile over the class search', () => {
    expect(
      profileDraft(profile, {
        faculty: '02',
        department: '01',
        curriculum: '21',
        classYear: '5',
      }),
    ).toEqual({
      faculty: '01',
      department: '05',
      curriculum: '137',
      classYear: '1',
    });
  });
});

describe('profileFromSelection', () => {
  it('builds the profile of a complete selection', () => {
    expect(
      profileFromSelection({
        faculty: '01',
        department: '05',
        curriculum: '137',
        classYear: '1',
      }),
    ).toEqual(profile);
  });

  it('returns null while a select is empty or holds an all value', () => {
    expect(
      profileFromSelection({
        faculty: '01',
        department: '05',
        curriculum: '137',
        classYear: '',
      }),
    ).toBeNull();
    expect(
      profileFromSelection({
        faculty: '01',
        department: '05',
        curriculum: 'all',
        classYear: '1',
      }),
    ).toBeNull();
  });
});
