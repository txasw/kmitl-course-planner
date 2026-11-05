import { describe, expect, it } from 'vitest';
import {
  EARLIEST_BUDDHIST_YEAR,
  buddhistYears,
  parseSemester,
  nextTerm,
  resolveInitialTerm,
  termFromQueryFields,
  toBuddhistYear,
  type Term,
} from './academicTerms';
import type { TeachTableRoute } from './parseTeachTableRoute';

describe('toBuddhistYear', () => {
  it('adds 543 to the Gregorian year', () => {
    expect(toBuddhistYear(2026)).toBe(2569);
  });
});

describe('buddhistYears', () => {
  it('runs from the earliest year through the current year plus one', () => {
    const years = buddhistYears(2569);
    expect(years[0]).toBe(String(EARLIEST_BUDDHIST_YEAR));
    expect(years).toContain('2569');
    expect(years.at(-1)).toBe('2570');
    expect(years).toHaveLength(2570 - EARLIEST_BUDDHIST_YEAR + 1);
  });

  it('never returns fewer than the earliest year for an old input', () => {
    expect(buddhistYears(2555)).toEqual([String(EARLIEST_BUDDHIST_YEAR)]);
  });
});

describe('parseSemester', () => {
  it('narrows the three semesters and rejects anything else', () => {
    expect(parseSemester('2')).toBe('2');
    expect(parseSemester('9')).toBeNull();
    expect(parseSemester('')).toBeNull();
    expect(parseSemester(undefined)).toBeNull();
  });
});

describe('termFromQueryFields', () => {
  it('reads a term only when both fields are usable', () => {
    expect(termFromQueryFields('2569', '2')).toEqual({
      year: '2569',
      semester: '2',
    });
    expect(termFromQueryFields('2569', undefined)).toBeNull();
    expect(termFromQueryFields('', '1')).toBeNull();
    expect(termFromQueryFields(undefined, '1')).toBeNull();
  });
});

describe('nextTerm', () => {
  it('advances the first semester to the second of the same year', () => {
    expect(nextTerm({ year: '2569', semester: '1' })).toEqual({
      year: '2569',
      semester: '2',
    });
  });

  it('advances the second semester to the third of the same year', () => {
    expect(nextTerm({ year: '2569', semester: '2' })).toEqual({
      year: '2569',
      semester: '3',
    });
  });

  it('rolls the third semester over to the first of the next year', () => {
    expect(nextTerm({ year: '2569', semester: '3' })).toEqual({
      year: '2570',
      semester: '1',
    });
  });
});

describe('resolveInitialTerm', () => {
  const years = buddhistYears(2569);
  const route: TeachTableRoute = {
    params: { selected_year: '2568', selected_semester: '2' },
  };
  const persisted: Term = { year: '2567', semester: '3' };
  const plan: Term = { year: '2566', semester: '2' };
  const current: Term = { year: '2569', semester: '1' };
  const none = { route: null, persisted: null, plan: null, current: null };

  it('takes the year and semester from a result route above every source', () => {
    expect(
      resolveInitialTerm({ route, persisted, plan, current, years }),
    ).toEqual({ term: { year: '2568', semester: '2' }, source: 'route' });
  });

  it('takes the persisted search above the plan and the registrar', () => {
    expect(
      resolveInitialTerm({ ...none, persisted, plan, current, years }),
    ).toEqual({ term: persisted, source: 'persisted' });
  });

  it('takes the active plan term above the registrar', () => {
    expect(resolveInitialTerm({ ...none, plan, current, years })).toEqual({
      term: plan,
      source: 'plan',
    });
  });

  it('opens on the term after the registrar current term', () => {
    expect(resolveInitialTerm({ ...none, current, years })).toEqual({
      term: { year: '2569', semester: '2' },
      source: 'registration',
    });
  });

  it('falls back to the newest year and first semester with no source', () => {
    expect(resolveInitialTerm({ ...none, years })).toEqual({
      term: { year: '2570', semester: '1' },
      source: 'fallback',
    });
  });

  it('skips a route without a usable year and semester', () => {
    const partial: TeachTableRoute = { params: { selected_semester: '9' } };
    expect(
      resolveInitialTerm({ ...none, route: partial, current, years }),
    ).toEqual({
      term: { year: '2569', semester: '2' },
      source: 'registration',
    });
  });
});
