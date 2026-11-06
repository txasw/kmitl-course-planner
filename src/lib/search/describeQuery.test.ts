import { describe, expect, it } from 'vitest';
import curriculaFixture from '../../../tests/fixtures/curriculum.level1.capture.json';
import departmentsFixture from '../../../tests/fixtures/department.capture.json';
import facultiesFixture from '../../../tests/fixtures/faculty.capture.json';
import subjectOwnersFixture from '../../../tests/fixtures/subject-owner.capture.json';
import {
  curriculumListSchema,
  departmentListSchema,
  facultyListSchema,
  subjectOwnerListSchema,
} from '../domain/schemas';
import { createTranslator } from '../i18n/t';
import type { TeachTableQuery } from '../messaging/protocol';
import type { ReferenceLists } from '../reference/filters';
import { describeQuery } from './describeQuery';
import {
  buildCategoryQuery,
  buildClassQuery,
  buildSubjectIdQuery,
} from './formState';

const th = createTranslator('th');
const en = createTranslator('en');
const term = { year: '2569', semester: '1' } as const;

const ready: ReferenceLists = {
  faculties: {
    status: 'ready',
    data: facultyListSchema.parse(facultiesFixture),
  },
  departments: {
    status: 'ready',
    data: departmentListSchema.parse(departmentsFixture),
  },
  curricula: {
    status: 'ready',
    data: curriculumListSchema.parse(curriculaFixture),
  },
  subjectOwners: {
    status: 'ready',
    data: subjectOwnerListSchema.parse(subjectOwnersFixture),
  },
};

const loading: ReferenceLists = {
  faculties: { status: 'loading' },
  departments: { status: 'loading' },
  curricula: { status: 'idle' },
  subjectOwners: { status: 'loading' },
};

function classQuery(
  overrides: Partial<Parameters<typeof buildClassQuery>[0]>,
): TeachTableQuery {
  return buildClassQuery({
    ...term,
    faculty: '01',
    department: '08',
    curriculum: '08',
    classYear: '4',
    ...overrides,
  });
}

describe('describeQuery by subject id', () => {
  const query = buildSubjectIdQuery({ ...term, subjectId: '90592033' });

  it('names the subject id with no qualifiers', () => {
    expect(describeQuery(query, ready, 'th', th)).toEqual({
      primary: 'รหัสวิชา 90592033',
      qualifiers: [],
    });
    expect(describeQuery(query, ready, 'en', en)).toEqual({
      primary: 'Subject 90592033',
      qualifiers: [],
    });
  });
});

describe('describeQuery by category', () => {
  it('names the category and the faculty acronym of the locale', () => {
    const query = buildCategoryQuery({
      ...term,
      faculty: '01',
      subjectOwner: '6',
    });
    expect(describeQuery(query, ready, 'th', th)).toEqual({
      primary: 'หมวดวิชา 9020xxxx กลุ่มภาษา',
      qualifiers: ['วศ'],
    });
    expect(describeQuery(query, ready, 'en', en)).toEqual({
      primary: 'Category 9020xxxx กลุ่มภาษา',
      qualifiers: ['ENG'],
    });
  });

  it('falls back to the faculty name when the faculty has no acronym', () => {
    const query = buildCategoryQuery({
      ...term,
      faculty: '22',
      subjectOwner: '6',
    });
    expect(describeQuery(query, ready, 'th', th).qualifiers).toEqual([
      'พยาบาลศาสตร์',
    ]);
    expect(describeQuery(query, ready, 'en', en).qualifiers).toEqual([
      'Nursing Science',
    ]);
  });

  it('reads all faculties when search_all_faculty is set', () => {
    const query = buildCategoryQuery({
      ...term,
      faculty: 'all',
      subjectOwner: '6',
    });
    expect(describeQuery(query, ready, 'th', th).qualifiers).toEqual([
      'ทุกคณะ',
    ]);
    expect(describeQuery(query, ready, 'en', en).qualifiers).toEqual([
      'All faculties',
    ]);
  });

  it('shows the raw ids while the reference lists load', () => {
    const query = buildCategoryQuery({
      ...term,
      faculty: '01',
      subjectOwner: '32',
    });
    expect(describeQuery(query, loading, 'th', th)).toEqual({
      primary: 'หมวดวิชา 32',
      qualifiers: ['01'],
    });
  });
});

describe('describeQuery by class', () => {
  it('names the curriculum short name and the class year', () => {
    expect(describeQuery(classQuery({}), ready, 'th', th)).toEqual({
      primary: 'วิศวกรรมโยธา',
      qualifiers: ['ชั้นปี 4'],
    });
    expect(describeQuery(classQuery({}), ready, 'en', en)).toEqual({
      primary: 'Civil Engineering',
      qualifiers: ['Year 4'],
    });
  });

  it('reads all class years for the class year 0 sentinel', () => {
    const query = classQuery({ classYear: 'all' });
    expect(query).toMatchObject({ selected_class_year: '0' });
    expect(describeQuery(query, ready, 'th', th).qualifiers).toEqual([
      'ทุกชั้นปี',
    ]);
    expect(describeQuery(query, ready, 'en', en).qualifiers).toEqual([
      'All years',
    ]);
  });

  it('names the department with all curricula for the x sentinel', () => {
    const query = classQuery({ curriculum: 'all' });
    expect(query).toMatchObject({ selected_curriculum: 'x' });
    expect(describeQuery(query, ready, 'th', th)).toEqual({
      primary: 'วิศวกรรมโยธา',
      qualifiers: ['ทุกหลักสูตร', 'ชั้นปี 4'],
    });
    expect(describeQuery(query, ready, 'en', en)).toEqual({
      primary: 'Civil Engineering',
      qualifiers: ['All curricula', 'Year 4'],
    });
  });

  it('names the faculty when departments are all too', () => {
    // The form never sends all departments today, so the query is written out.
    const query: TeachTableQuery = {
      mode: 'by_class',
      selected_year: '2569',
      selected_semester: '1',
      selected_faculty: '01',
      selected_department: 'x',
      selected_curriculum: 'x',
      selected_class_year: '0',
      search_all_faculty: false,
      search_all_department: true,
      search_all_curriculum: true,
      search_all_class_year: true,
    };
    expect(describeQuery(query, ready, 'th', th)).toEqual({
      primary: 'วิศวกรรมศาสตร์',
      qualifiers: ['ทุกหลักสูตร', 'ทุกชั้นปี'],
    });
  });

  it('matches a curriculum id whatever its width', () => {
    const wide = classQuery({ curriculum: '121' });
    expect(describeQuery(wide, ready, 'en', en).primary).toBe(
      'Engineering Management and Entrepreneurship (International Program)',
    );
    const padded = classQuery({
      faculty: '15',
      department: '02',
      curriculum: '06',
    });
    const narrow = classQuery({
      faculty: '15',
      department: '02',
      curriculum: '6',
    });
    const name = describeQuery(narrow, ready, 'th', th).primary;
    expect(name).toBe('การจัดการบริการการบิน');
    expect(describeQuery(padded, ready, 'th', th).primary).toBe(name);
  });

  it('shows the raw ids while the reference lists load', () => {
    expect(describeQuery(classQuery({}), loading, 'th', th)).toEqual({
      primary: '08',
      qualifiers: ['ชั้นปี 4'],
    });
    expect(
      describeQuery(classQuery({ curriculum: 'all' }), loading, 'th', th)
        .primary,
    ).toBe('08');
  });

  it('shows the raw id for a curriculum the list does not hold', () => {
    expect(
      describeQuery(classQuery({ curriculum: '999' }), ready, 'th', th).primary,
    ).toBe('999');
  });
});
