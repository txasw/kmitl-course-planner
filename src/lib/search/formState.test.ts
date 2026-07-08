import { describe, expect, it } from 'vitest';
import { teachTableQuerySchema } from '../messaging/protocol';
import type { Term } from '../routing/academicTerms';
import {
  asClassYear,
  asSemester,
  buildCategoryQuery,
  buildClassQuery,
  buildSubjectIdQuery,
  buildTeachTableQueryForTab,
  defaultCategoryForm,
  defaultClassForm,
  defaultSubjectIdForm,
  isCategoryFormReady,
  isClassFormReady,
  isSubjectIdFormReady,
  isValidSubjectId,
} from './formState';

const term: Term = { year: '2569', semester: '1' };

describe('isValidSubjectId', () => {
  it('accepts 1 to 8 digits', () => {
    expect(isValidSubjectId('1')).toBe(true);
    expect(isValidSubjectId('90592033')).toBe(true);
  });

  it('rejects empty, too long, and non digit input', () => {
    expect(isValidSubjectId('')).toBe(false);
    expect(isValidSubjectId('123456789')).toBe(false);
    expect(isValidSubjectId('12a')).toBe(false);
  });
});

describe('narrowing helpers', () => {
  it('narrows a valid semester and rejects others', () => {
    expect(asSemester('2')).toBe('2');
    expect(asSemester('9')).toBeNull();
    expect(asSemester('')).toBeNull();
  });

  it('narrows a valid class year including the all option', () => {
    expect(asClassYear('4')).toBe('4');
    expect(asClassYear('all')).toBe('all');
    expect(asClassYear('99')).toBeNull();
  });
});

describe('default forms', () => {
  it('seed the term and leave selects empty', () => {
    const form = defaultClassForm(term);
    expect(form.year).toBe('2569');
    expect(form.semester).toBe('1');
    expect(form.faculty).toBe('');
    expect(form.classYear).toBe('all');
  });
});

describe('form readiness', () => {
  it('requires faculty, department, and curriculum for the class tab', () => {
    const form = defaultClassForm(term);
    expect(isClassFormReady(form)).toBe(false);
    const ready = {
      ...form,
      faculty: '01',
      department: '01',
      curriculum: '121',
    };
    expect(isClassFormReady(ready)).toBe(true);
  });

  it('requires a year and a valid subject id for the subject id tab', () => {
    const form = defaultSubjectIdForm(term);
    expect(isSubjectIdFormReady({ ...form, subjectId: '' })).toBe(false);
    expect(isSubjectIdFormReady({ ...form, subjectId: '90592033' })).toBe(true);
    expect(
      isSubjectIdFormReady({ ...form, subjectId: '90592033', year: '' }),
    ).toBe(false);
  });

  it('requires faculty and subject owner for the category tab', () => {
    const form = defaultCategoryForm(term);
    expect(isCategoryFormReady(form)).toBe(false);
    expect(
      isCategoryFormReady({ ...form, faculty: '01', subjectOwner: '32' }),
    ).toBe(true);
  });

  it('requires a year on both tabs', () => {
    const category = {
      ...defaultCategoryForm(term),
      faculty: '01',
      subjectOwner: '32',
    };
    expect(isCategoryFormReady({ ...category, year: '' })).toBe(false);
    const classForm = {
      ...defaultClassForm(term),
      faculty: '01',
      department: '01',
      curriculum: '121',
    };
    expect(isClassFormReady({ ...classForm, year: '' })).toBe(false);
  });
});

describe('query builders', () => {
  it('builds a valid by_class query and flags all class years', () => {
    const query = buildClassQuery({
      ...defaultClassForm(term),
      faculty: '01',
      department: '08',
      curriculum: '121',
      classYear: 'all',
    });
    expect(teachTableQuerySchema.safeParse(query).success).toBe(true);
    expect(query).toMatchObject({
      mode: 'by_class',
      selected_faculty: '01',
      search_all_class_year: true,
      // The host sends 0, not an empty value, for the all option.
      selected_class_year: '0',
    });
  });

  it('sends a specific class year when one is chosen', () => {
    const query = buildClassQuery({
      ...defaultClassForm(term),
      faculty: '01',
      department: '08',
      curriculum: '121',
      classYear: '4',
    });
    if (query.mode !== 'by_class') throw new Error('wrong mode');
    expect(query.search_all_class_year).toBe(false);
    expect(query.selected_class_year).toBe('4');
  });

  it('builds an all curricula by_class query with the x sentinel', () => {
    const query = buildClassQuery({
      ...defaultClassForm(term),
      faculty: '01',
      department: '08',
      curriculum: 'all',
      classYear: '1',
    });
    expect(teachTableQuerySchema.safeParse(query).success).toBe(true);
    if (query.mode !== 'by_class') throw new Error('wrong mode');
    expect(query.search_all_curriculum).toBe(true);
    expect(query.selected_curriculum).toBe('x');
  });

  it('builds an all faculties category query without selected_faculty', () => {
    const query = buildCategoryQuery({
      ...defaultCategoryForm(term),
      faculty: 'all',
      subjectOwner: '32',
    });
    expect(teachTableQuerySchema.safeParse(query).success).toBe(true);
    expect(query).toMatchObject({
      mode: 'by_subject_owner_id',
      search_all_faculty: true,
      selected_subject_owner_id: '32',
    });
    expect('selected_faculty' in query).toBe(false);
  });

  it('builds a by_subject_id query that searches everything', () => {
    const query = buildSubjectIdQuery({
      ...defaultSubjectIdForm(term),
      subjectId: '90592033',
    });
    expect(teachTableQuerySchema.safeParse(query).success).toBe(true);
    // The host omits the specific selects and sets every search_all_* flag.
    expect(query).toMatchObject({
      mode: 'by_subject_id',
      selected_subject_id: '90592033',
      search_all_faculty: true,
      search_all_department: true,
      search_all_curriculum: true,
      search_all_class_year: true,
    });
    expect('selected_faculty' in query).toBe(false);
  });

  it('builds a valid by_subject_owner_id query', () => {
    const query = buildCategoryQuery({
      ...defaultCategoryForm(term),
      faculty: '01',
      subjectOwner: '32',
    });
    expect(teachTableQuerySchema.safeParse(query).success).toBe(true);
    expect(query).toMatchObject({
      mode: 'by_subject_owner_id',
      selected_faculty: '01',
      selected_subject_owner_id: '32',
    });
  });
});

describe('buildTeachTableQueryForTab', () => {
  const forms = {
    byClass: defaultClassForm(term),
    bySubjectId: defaultSubjectIdForm(term),
    byCategory: defaultCategoryForm(term),
  };

  it('returns null when the active tab form is not ready', () => {
    expect(buildTeachTableQueryForTab('by_class', forms)).toBeNull();
    expect(buildTeachTableQueryForTab('by_subject_owner_id', forms)).toBeNull();
  });

  it('builds the query for the active tab when its form is ready', () => {
    const ready = {
      ...forms,
      byCategory: {
        ...forms.byCategory,
        faculty: '01',
        subjectOwner: '32',
      },
    };
    const query = buildTeachTableQueryForTab('by_subject_owner_id', ready);
    expect(query?.mode).toBe('by_subject_owner_id');
  });
});
