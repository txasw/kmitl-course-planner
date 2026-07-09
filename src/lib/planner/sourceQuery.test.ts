import { describe, it, expect } from 'vitest';
import type { TeachTableQuery } from '../messaging/protocol';
import {
  sourceQueryToQuery,
  termFromSourceQueryParams,
  toSourceQuery,
} from './sourceQuery';

describe('toSourceQuery', () => {
  it('stringifies the boolean flags of a by_class query', () => {
    const query: TeachTableQuery = {
      mode: 'by_class',
      selected_year: '2569',
      selected_semester: '1',
      selected_faculty: '01',
      selected_department: '08',
      selected_curriculum: 'x',
      selected_class_year: '0',
      search_all_faculty: false,
      search_all_department: false,
      search_all_curriculum: true,
      search_all_class_year: true,
    };
    const source = toSourceQuery(query);
    expect(source.endpoint).toBe('get-teach-table-show');
    expect(source.params.mode).toBe('by_class');
    expect(source.params.search_all_curriculum).toBe('true');
    expect(source.params.search_all_faculty).toBe('false');
    expect(source.params.selected_year).toBe('2569');
  });

  it('drops an omitted optional select', () => {
    const query: TeachTableQuery = {
      mode: 'by_subject_owner_id',
      selected_year: '2569',
      selected_semester: '1',
      search_all_faculty: true,
      selected_subject_owner_id: '32',
    };
    const source = toSourceQuery(query);
    expect('selected_faculty' in source.params).toBe(false);
    expect(source.params.selected_subject_owner_id).toBe('32');
  });
});

describe('termFromSourceQueryParams', () => {
  it('reads the year and semester a query targeted', () => {
    expect(
      termFromSourceQueryParams({
        selected_year: '2569',
        selected_semester: '2',
      }),
    ).toEqual({ year: '2569', semester: '2' });
  });

  it('defaults the semester and year for a degenerate empty map', () => {
    expect(termFromSourceQueryParams({})).toEqual({ year: '', semester: '1' });
  });

  it('falls back to the first semester on an out of range value', () => {
    expect(
      termFromSourceQueryParams({
        selected_year: '2569',
        selected_semester: '9',
      }).semester,
    ).toBe('1');
  });
});

describe('sourceQueryToQuery', () => {
  it('round trips a by_class query through the stored params', () => {
    const query: TeachTableQuery = {
      mode: 'by_class',
      selected_year: '2569',
      selected_semester: '1',
      selected_faculty: '01',
      selected_department: '08',
      selected_curriculum: 'x',
      selected_class_year: '0',
      search_all_faculty: false,
      search_all_department: false,
      search_all_curriculum: true,
      search_all_class_year: true,
    };
    expect(sourceQueryToQuery(toSourceQuery(query).params)).toEqual(query);
  });

  it('round trips a by_subject_owner_id query with the optional faculty omitted', () => {
    const query: TeachTableQuery = {
      mode: 'by_subject_owner_id',
      selected_year: '2569',
      selected_semester: '1',
      search_all_faculty: true,
      selected_subject_owner_id: '32',
    };
    expect(sourceQueryToQuery(toSourceQuery(query).params)).toEqual(query);
  });

  it('coerces the flags by key so a select value of true stays a string', () => {
    const back = sourceQueryToQuery({
      mode: 'by_subject_id',
      selected_year: '2569',
      selected_semester: '1',
      selected_subject_id: 'true',
      search_all_faculty: 'true',
      search_all_department: 'true',
      search_all_curriculum: 'true',
      search_all_class_year: 'true',
    });
    expect(back?.mode).toBe('by_subject_id');
    if (back?.mode === 'by_subject_id') {
      expect(back.selected_subject_id).toBe('true');
      expect(back.search_all_faculty).toBe(true);
    }
  });

  it('returns null for params that do not form a query', () => {
    expect(sourceQueryToQuery({})).toBeNull();
  });
});
