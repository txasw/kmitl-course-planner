import { describe, expect, it } from 'vitest';
import { parseTeachTableRoute } from './parseTeachTableRoute';

describe('parseTeachTableRoute', () => {
  it('parses a result route into its params', () => {
    // The exact hash captured from the live result page snapshot.
    const hash =
      '#/teach_table?mode=by_subject_owner_id&selected_year=2569&selected_semester=1&selected_faculty=01&search_all_faculty=false&selected_subject_owner_id=46';
    const route = parseTeachTableRoute(hash);
    expect(route).not.toBeNull();
    expect(route?.params).toEqual({
      mode: 'by_subject_owner_id',
      selected_year: '2569',
      selected_semester: '1',
      selected_faculty: '01',
      search_all_faculty: 'false',
      selected_subject_owner_id: '46',
    });
  });

  it('accepts a hash without the leading marker', () => {
    const route = parseTeachTableRoute('/teach_table?selected_year=2568');
    expect(route?.params.selected_year).toBe('2568');
  });

  it('returns null for the selector route', () => {
    expect(parseTeachTableRoute('#/teach_table_selector')).toBeNull();
  });

  it('returns null for a result route with no query', () => {
    expect(parseTeachTableRoute('#/teach_table')).toBeNull();
  });

  it('returns null for an unrelated route', () => {
    expect(parseTeachTableRoute('#/')).toBeNull();
    expect(parseTeachTableRoute('#/home')).toBeNull();
  });

  it('returns empty params for a result route with an empty query', () => {
    expect(parseTeachTableRoute('#/teach_table?')).toEqual({ params: {} });
  });
});
