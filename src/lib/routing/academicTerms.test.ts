import { describe, expect, it } from 'vitest';
import {
  EARLIEST_BUDDHIST_YEAR,
  buddhistYears,
  parseSemester,
  resolveInitialTerm,
  termFromQueryFields,
  toBuddhistYear,
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

describe('resolveInitialTerm', () => {
  const years = buddhistYears(2569);

  it('takes the year and semester from a result route', () => {
    const route: TeachTableRoute = {
      params: { selected_year: '2568', selected_semester: '2' },
    };
    expect(resolveInitialTerm(route, years)).toEqual({
      year: '2568',
      semester: '2',
    });
  });

  it('falls back to the newest year and first semester without a route', () => {
    expect(resolveInitialTerm(null, years)).toEqual({
      year: '2570',
      semester: '1',
    });
  });

  it('ignores an out of range semester and keeps the newest year', () => {
    const route: TeachTableRoute = {
      params: { selected_semester: '9' },
    };
    expect(resolveInitialTerm(route, years)).toEqual({
      year: '2570',
      semester: '1',
    });
  });
});
