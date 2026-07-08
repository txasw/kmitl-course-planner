import { describe, expect, it } from 'vitest';
import { loadFixture } from '../../../tests/support/fixtures';
import {
  curriculumListSchema,
  departmentListSchema,
  facultyListSchema,
  subjectOwnerListSchema,
  type RawCurriculum,
} from '../domain/schemas';
import {
  curriculaFor,
  departmentsForFaculty,
  idsEqual,
  sortFacultiesById,
  sortSubjectOwners,
} from './filters';

const faculties = facultyListSchema.parse(loadFixture('faculty.capture.json'));
const departments = departmentListSchema.parse(
  loadFixture('department.capture.json'),
);
const curricula = curriculumListSchema.parse(
  loadFixture('curriculum.level1.capture.json'),
);
const subjectOwners = subjectOwnerListSchema.parse(
  loadFixture('subject-owner.capture.json'),
);

function find<T>(items: readonly T[], match: (item: T) => boolean): T {
  const found = items.find(match);
  if (found === undefined) {
    throw new Error('fixture is missing an expected row');
  }
  return found;
}

describe('idsEqual', () => {
  it('matches exact strings', () => {
    expect(idsEqual('01', '01')).toBe(true);
    expect(idsEqual('x', 'x')).toBe(true);
  });

  it('matches numerically across padding widths', () => {
    expect(idsEqual('01', '1')).toBe(true);
    expect(idsEqual('001', '1')).toBe(true);
    expect(idsEqual('121', '121')).toBe(true);
  });

  it('rejects different values and mixed non numeric ids', () => {
    expect(idsEqual('1', '2')).toBe(false);
    expect(idsEqual('a1', '1')).toBe(false);
    expect(idsEqual('x', 'y')).toBe(false);
  });
});

describe('sortFacultiesById', () => {
  it('orders faculties ascending by id without mutating the input', () => {
    const input = [...faculties];
    const sorted = sortFacultiesById(input);
    expect(sorted[0]?.FACULTY_ID).toBe('01');
    for (let i = 1; i < sorted.length; i += 1) {
      expect(
        Number(sorted[i]?.FACULTY_ID) >= Number(sorted[i - 1]?.FACULTY_ID),
      ).toBe(true);
    }
    expect(input).toEqual(faculties);
  });
});

describe('departmentsForFaculty', () => {
  it('returns only departments of the faculty', () => {
    const result = departmentsForFaculty(departments, '01');
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((d) => d.faculty_id === '01')).toBe(true);
    expect(result.some((d) => d.department_name_th.length > 0)).toBe(true);
  });

  it('tolerates an unpadded faculty id', () => {
    expect(departmentsForFaculty(departments, '1')).toEqual(
      departmentsForFaculty(departments, '01'),
    );
  });
});

describe('curriculaFor', () => {
  it('returns only active curricula of the faculty and department', () => {
    const sample = find(
      curricula,
      (c) => c.ACTIVE === '1' && c.REGISTRAR_DEPARTMENT_ID !== '',
    );
    const result = curriculaFor(
      curricula,
      sample.FACULTY_ID,
      sample.REGISTRAR_DEPARTMENT_ID,
    );
    expect(result.length).toBeGreaterThan(0);
    expect(
      result.every(
        (c) =>
          c.ACTIVE === '1' &&
          idsEqual(c.FACULTY_ID, sample.FACULTY_ID) &&
          (c.REGISTRAR_DEPARTMENT_ID === '' ||
            idsEqual(
              c.REGISTRAR_DEPARTMENT_ID,
              sample.REGISTRAR_DEPARTMENT_ID,
            )),
      ),
    ).toBe(true);
  });

  it('includes an empty department curriculum for any department in the faculty', () => {
    const openEnded = find(
      curricula,
      (c) => c.REGISTRAR_DEPARTMENT_ID === '' && c.ACTIVE === '1',
    );
    const result = curriculaFor(curricula, openEnded.FACULTY_ID, '99');
    expect(
      result.some(
        (c) =>
          c.REGISTRAR_CURRICULUM2_ID === openEnded.REGISTRAR_CURRICULUM2_ID,
      ),
    ).toBe(true);
  });

  it('excludes inactive curricula', () => {
    const active = find(curricula, (c) => c.ACTIVE === '1');
    const inactive: RawCurriculum = { ...active, ACTIVE: '0' };
    const result = curriculaFor(
      [inactive],
      active.FACULTY_ID,
      active.REGISTRAR_DEPARTMENT_ID,
    );
    expect(result).toHaveLength(0);
  });
});

describe('sortSubjectOwners', () => {
  it('returns every owner without mutating the input', () => {
    const input = [...subjectOwners];
    const sorted = sortSubjectOwners(input, 'th');
    expect(sorted).toHaveLength(subjectOwners.length);
    expect(input).toEqual(subjectOwners);
  });
});
