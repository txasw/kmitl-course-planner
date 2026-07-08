import { describe, expect, it } from 'vitest';
import { teachTableQuerySchema } from '../messaging/protocol';
import type { Term } from '../routing/academicTerms';
import {
  buildCategoryQuery,
  buildClassQuery,
  buildSubjectIdQuery,
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

  it('requires a valid subject id on top of the class fields', () => {
    const base = {
      ...defaultSubjectIdForm(term),
      faculty: '01',
      department: '01',
      curriculum: '121',
    };
    expect(isSubjectIdFormReady({ ...base, subjectId: '' })).toBe(false);
    expect(isSubjectIdFormReady({ ...base, subjectId: '90592033' })).toBe(true);
  });

  it('requires faculty and subject owner for the category tab', () => {
    const form = defaultCategoryForm(term);
    expect(isCategoryFormReady(form)).toBe(false);
    expect(
      isCategoryFormReady({ ...form, faculty: '01', subjectOwner: '32' }),
    ).toBe(true);
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
      selected_class_year: '',
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

  it('builds a valid by_subject_id query', () => {
    const query = buildSubjectIdQuery({
      ...defaultSubjectIdForm(term),
      faculty: '01',
      department: '08',
      curriculum: '121',
      subjectId: '90592033',
    });
    expect(teachTableQuerySchema.safeParse(query).success).toBe(true);
    expect(query).toMatchObject({
      mode: 'by_subject_id',
      selected_subject_id: '90592033',
    });
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
