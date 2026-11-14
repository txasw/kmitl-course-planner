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
  curriculumBelongsTo,
  departmentsForFaculty,
  disambiguateCurricula,
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

describe('curriculumBelongsTo', () => {
  it('matches the faculty and department whatever their width', () => {
    const sample = find(
      curricula,
      (c) => c.FACULTY_ID === '01' && c.REGISTRAR_DEPARTMENT_ID !== '',
    );
    const narrowDepartment = String(Number(sample.REGISTRAR_DEPARTMENT_ID));
    expect(curriculumBelongsTo(sample, '1', narrowDepartment)).toBe(true);
    expect(curriculumBelongsTo(sample, '02', narrowDepartment)).toBe(false);
  });

  it('places an empty department curriculum in every department of its faculty', () => {
    const openEnded = find(curricula, (c) => c.REGISTRAR_DEPARTMENT_ID === '');
    expect(curriculumBelongsTo(openEnded, openEnded.FACULTY_ID, '99')).toBe(
      true,
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

describe('disambiguateCurricula', () => {
  // Faculty 11 department 01 lists two revisions of the continuing manufacturing
  // systems curriculum (2566 and 2567) under one Thai short name, and the two 2555
  // curricula share an English short name in the same year.
  const manufacturing = curriculaFor(curricula, '11', '01');

  function labels(options: ReturnType<typeof disambiguateCurricula>): string[] {
    return options.map((option) => option.label);
  }

  it('appends the revision year to the colliding Thai pair, newest first', () => {
    expect(labels(disambiguateCurricula(manufacturing, 'th'))).toEqual([
      'วิศวกรรมระบบการผลิต',
      'วิศวกรรมระบบการผลิต (โครงการอาชีวะพรีเมียม)',
      'วิศวกรรมระบบการผลิต (ต่อเนื่อง) (โครงการอาชีวะพรีเมียม)',
      'วิศวกรรมระบบการผลิต (ต่อเนื่อง) (2567)',
      'วิศวกรรมระบบการผลิต (ต่อเนื่อง) (2566)',
    ]);
  });

  it('adds the curriculum id when the year does not separate a collision', () => {
    expect(labels(disambiguateCurricula(manufacturing, 'en'))).toEqual([
      'Manufacturing System Engineering (2555, 01)',
      'Manufacturing System Engineering (2555, 02)',
      'Manufacturing System Engineering (Continuing)',
      'Manufacturing System Engineering (Continuing Program) (2567)',
      'Manufacturing System Engineering (Continuing Program) (2566)',
    ]);
  });

  it('keeps every curriculum exactly once', () => {
    const options = disambiguateCurricula(manufacturing, 'th');
    expect(options.map((option) => option.curriculum)).toHaveLength(
      manufacturing.length,
    );
    expect(new Set(options.map((option) => option.curriculum))).toEqual(
      new Set(manufacturing),
    );
  });

  it('leaves names without a collision unchanged and in order', () => {
    const base = find(curricula, (c) => c.ACTIVE === '1');
    const first: RawCurriculum = {
      ...base,
      SHORT_NAME_TH: 'หลักสูตร ก',
      YEAR: '2560',
    };
    const second: RawCurriculum = {
      ...base,
      SHORT_NAME_TH: 'หลักสูตร ข',
      YEAR: '2565',
    };
    expect(labels(disambiguateCurricula([first, second], 'th'))).toEqual([
      'หลักสูตร ก',
      'หลักสูตร ข',
    ]);
  });

  it('groups a synthetic pair at the first position and treats spacing as equal', () => {
    const base = find(curricula, (c) => c.ACTIVE === '1');
    const older: RawCurriculum = {
      ...base,
      SHORT_NAME_EN: 'Data  Science',
      YEAR: '2560',
      REGISTRAR_CURRICULUM2_ID: '7',
    };
    const other: RawCurriculum = {
      ...base,
      SHORT_NAME_EN: 'Physics',
      YEAR: '2564',
    };
    const newer: RawCurriculum = {
      ...base,
      SHORT_NAME_EN: 'Data Science',
      YEAR: '2565',
      REGISTRAR_CURRICULUM2_ID: '12',
    };
    expect(labels(disambiguateCurricula([older, other, newer], 'en'))).toEqual([
      'Data Science (2565)',
      'Data  Science (2560)',
      'Physics',
    ]);
  });

  it('orders entries of one revision year by curriculum id', () => {
    // Faculty 20 department 03 lists four 2563 curricula under one English name,
    // returned by the endpoint in descending id order.
    const business = labels(
      disambiguateCurricula(curriculaFor(curricula, '20', '03'), 'en'),
    ).filter((label) =>
      label.startsWith('Business Administration and Entrepreneurship'),
    );
    expect(business).toEqual([
      'Business Administration and Entrepreneurship (2563, 515)',
      'Business Administration and Entrepreneurship (2563, 517)',
      'Business Administration and Entrepreneurship (2563, 523)',
      'Business Administration and Entrepreneurship (2563, 527)',
    ]);
  });

  it('falls back to the curriculum id when a colliding entry has no year', () => {
    const base = find(curricula, (c) => c.ACTIVE === '1');
    const dated: RawCurriculum = {
      ...base,
      SHORT_NAME_EN: 'Chemistry',
      YEAR: '2566',
    };
    const undated: RawCurriculum = {
      ...base,
      SHORT_NAME_EN: 'Chemistry',
      YEAR: '',
      REGISTRAR_CURRICULUM2_ID: '9',
    };
    expect(labels(disambiguateCurricula([undated, dated], 'en'))).toEqual([
      'Chemistry (2566)',
      'Chemistry (9)',
    ]);
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
