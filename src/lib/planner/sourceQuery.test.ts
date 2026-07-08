import { describe, it, expect } from 'vitest';
import type { TeachTableQuery } from '../messaging/protocol';
import { toSourceQuery } from './sourceQuery';

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
