import { describe, expect, it } from 'vitest';
import { teachTableQuerySchema } from '../messaging/protocol';
import type { Term } from '../routing/academicTerms';
import {
  asClassYear,
  buildCategoryQuery,
  buildClassQuery,
  buildSubjectIdQuery,
  buildTeachTableQueryForTab,
  clearTabForm,
  defaultCategoryForm,
  defaultClassForm,
  defaultSubjectIdForm,
  isCategoryFormReady,
  isClassFormReady,
  isSubjectIdFormReady,
  isTermReady,
  isValidSubjectId,
  missingField,
  sanitizeSubjectId,
  type SearchForms,
} from './formState';

const term: Term = { year: '2569', semester: '1' };

describe('isValidSubjectId', () => {
  it('accepts exactly eight digits', () => {
    expect(isValidSubjectId('90592033')).toBe(true);
    expect(isValidSubjectId('01234567')).toBe(true);
  });

  it('rejects fewer than eight, more than eight, and non digit input', () => {
    expect(isValidSubjectId('')).toBe(false);
    expect(isValidSubjectId('1')).toBe(false);
    expect(isValidSubjectId('1234567')).toBe(false);
    expect(isValidSubjectId('123456789')).toBe(false);
    expect(isValidSubjectId('12a')).toBe(false);
  });
});

describe('sanitizeSubjectId', () => {
  it('strips non digits from mixed input', () => {
    expect(sanitizeSubjectId('12313213123asdasd')).toBe('12313213');
  });

  it('clamps to eight digits', () => {
    expect(sanitizeSubjectId('123456789')).toBe('12345678');
  });

  it('preserves leading zeros', () => {
    expect(sanitizeSubjectId('01234567')).toBe('01234567');
  });

  it('returns empty for all letters', () => {
    expect(sanitizeSubjectId('abcdef')).toBe('');
  });
});

describe('narrowing helpers', () => {
  it('narrows a valid class year including the all option', () => {
    expect(asClassYear('4')).toBe('4');
    expect(asClassYear('all')).toBe('all');
    expect(asClassYear('99')).toBeNull();
  });
});

describe('default forms', () => {
  it('leave the selects empty and carry no term of their own', () => {
    const form = defaultClassForm();
    expect(form.faculty).toBe('');
    expect(form.classYear).toBe('all');
    expect('year' in form).toBe(false);
    expect('semester' in form).toBe(false);
  });
});

describe('form readiness', () => {
  it('requires faculty, department, and curriculum for the class tab', () => {
    const form = defaultClassForm();
    expect(isClassFormReady(form)).toBe(false);
    const ready = {
      ...form,
      faculty: '01',
      department: '01',
      curriculum: '121',
    };
    expect(isClassFormReady(ready)).toBe(true);
  });

  it('requires a full eight digit subject id for the subject id tab', () => {
    const form = defaultSubjectIdForm();
    expect(isSubjectIdFormReady({ ...form, subjectId: '' })).toBe(false);
    expect(isSubjectIdFormReady({ ...form, subjectId: '9059203' })).toBe(false);
    expect(isSubjectIdFormReady({ ...form, subjectId: '90592033' })).toBe(true);
  });

  it('requires faculty and subject owner for the category tab', () => {
    const form = defaultCategoryForm();
    expect(isCategoryFormReady(form)).toBe(false);
    expect(
      isCategoryFormReady({ ...form, faculty: '01', subjectOwner: '32' }),
    ).toBe(true);
  });

  it('treats a term as ready once its year is seeded', () => {
    expect(isTermReady(term)).toBe(true);
    expect(isTermReady({ year: '', semester: '1' })).toBe(false);
  });
});

describe('missingField', () => {
  const forms = (): SearchForms => ({
    byClass: defaultClassForm(),
    bySubjectId: defaultSubjectIdForm(),
    byCategory: defaultCategoryForm(),
  });

  it('names the class tab fields in the order they appear', () => {
    const base = forms();
    expect(missingField('by_class', term, base)).toBe('faculty');
    const byClass = { ...base.byClass, faculty: '01' };
    expect(missingField('by_class', term, { ...base, byClass })).toBe(
      'department',
    );
    const withDepartment = { ...byClass, department: '08' };
    expect(
      missingField('by_class', term, { ...base, byClass: withDepartment }),
    ).toBe('curriculum');
    expect(
      missingField('by_class', term, {
        ...base,
        byClass: { ...withDepartment, curriculum: '121' },
      }),
    ).toBeNull();
  });

  it('names the shared year before any other field on every tab', () => {
    const base = forms();
    const noYear: Term = { ...term, year: '' };
    expect(missingField('by_class', noYear, base)).toBe('year');
    expect(missingField('by_subject_id', noYear, base)).toBe('year');
    expect(missingField('by_subject_owner_id', noYear, base)).toBe('year');
  });

  it('names an incomplete subject id on the subject id tab', () => {
    const base = forms();
    expect(missingField('by_subject_id', term, base)).toBe('subjectId');
    expect(
      missingField('by_subject_id', term, {
        ...base,
        bySubjectId: { ...base.bySubjectId, subjectId: '9059203' },
      }),
    ).toBe('subjectId');
    expect(
      missingField('by_subject_id', term, {
        ...base,
        bySubjectId: { ...base.bySubjectId, subjectId: '90592033' },
      }),
    ).toBeNull();
  });

  it('names the faculty and then the category on the category tab', () => {
    const base = forms();
    expect(missingField('by_subject_owner_id', term, base)).toBe('faculty');
    const byCategory = { ...base.byCategory, faculty: 'all' };
    expect(
      missingField('by_subject_owner_id', term, { ...base, byCategory }),
    ).toBe('subjectOwner');
    expect(
      missingField('by_subject_owner_id', term, {
        ...base,
        byCategory: { ...byCategory, subjectOwner: '32' },
      }),
    ).toBeNull();
  });

  it('agrees with the readiness check of each tab', () => {
    const base = forms();
    expect(missingField('by_class', term, base) === null).toBe(
      isClassFormReady(base.byClass),
    );
    expect(missingField('by_subject_owner_id', term, base) === null).toBe(
      isCategoryFormReady(base.byCategory),
    );
  });
});

describe('query builders', () => {
  it('builds a valid by_class query and flags all class years', () => {
    const query = buildClassQuery(term, {
      ...defaultClassForm(),
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
    const query = buildClassQuery(term, {
      ...defaultClassForm(),
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
    const query = buildClassQuery(term, {
      ...defaultClassForm(),
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
    const query = buildCategoryQuery(term, {
      ...defaultCategoryForm(),
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
    const query = buildSubjectIdQuery(term, {
      ...defaultSubjectIdForm(),
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
    const query = buildCategoryQuery(term, {
      ...defaultCategoryForm(),
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
    byClass: defaultClassForm(),
    bySubjectId: defaultSubjectIdForm(),
    byCategory: defaultCategoryForm(),
  };
  const readyCategory = {
    ...forms,
    byCategory: { ...forms.byCategory, faculty: '01', subjectOwner: '32' },
  };

  it('returns null when the active tab form is not ready', () => {
    expect(buildTeachTableQueryForTab('by_class', term, forms)).toBeNull();
    expect(
      buildTeachTableQueryForTab('by_subject_owner_id', term, forms),
    ).toBeNull();
  });

  it('returns null while the shared term has no year', () => {
    expect(
      buildTeachTableQueryForTab(
        'by_subject_owner_id',
        { year: '', semester: '1' },
        readyCategory,
      ),
    ).toBeNull();
  });

  it('builds the active tab query under the shared term', () => {
    const query = buildTeachTableQueryForTab(
      'by_subject_owner_id',
      { year: '2569', semester: '2' },
      readyCategory,
    );
    expect(query).toMatchObject({
      mode: 'by_subject_owner_id',
      selected_year: '2569',
      selected_semester: '2',
    });
  });
});

describe('clearTabForm', () => {
  const filled: SearchForms = {
    byClass: {
      faculty: '01',
      department: '08',
      curriculum: '121',
      classYear: '3',
    },
    bySubjectId: { subjectId: '90592033' },
    byCategory: { faculty: '01', subjectOwner: '32' },
  };

  it('resets only the given tab', () => {
    const cleared = clearTabForm('by_class', filled);
    expect(cleared.byClass).toEqual(defaultClassForm());
    expect(cleared.bySubjectId).toBe(filled.bySubjectId);
    expect(cleared.byCategory).toBe(filled.byCategory);
  });

  it('clears the subject id and the category fields', () => {
    expect(clearTabForm('by_subject_id', filled).bySubjectId).toEqual({
      subjectId: '',
    });
    expect(clearTabForm('by_subject_owner_id', filled).byCategory).toEqual({
      faculty: '',
      subjectOwner: '',
    });
  });
});
