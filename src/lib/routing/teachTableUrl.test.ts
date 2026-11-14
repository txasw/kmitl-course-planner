import { describe, expect, it } from 'vitest';
import { formsFromQuery } from '../search/queryForms';
import { sourceQueryToQuery } from '../planner/sourceQuery';
import { REGIS_ORIGIN } from '../shell/hostTab';
import type { Term } from './academicTerms';
import { parseTeachTableRoute } from './parseTeachTableRoute';
import { subjectListingUrl, teachTableUrl } from './teachTableUrl';

const TERM: Term = { year: '2569', semester: '1' };

function hashOf(url: string): string {
  return new URL(url).hash;
}

describe('teachTableUrl', () => {
  it('opens the host result route on the registration origin', () => {
    const url = new URL(teachTableUrl({ mode: 'by_subject_id' }));
    expect(url.origin).toBe(REGIS_ORIGIN);
    expect(url.pathname).toBe('/');
    expect(url.hash).toBe('#/teach_table?mode=by_subject_id');
  });

  it('round trips its params through parseTeachTableRoute', () => {
    // The exact result hash captured from the live result page snapshot.
    const params = {
      mode: 'by_subject_owner_id',
      selected_year: '2569',
      selected_semester: '1',
      selected_faculty: '01',
      search_all_faculty: 'false',
      selected_subject_owner_id: '46',
    };
    expect(parseTeachTableRoute(hashOf(teachTableUrl(params)))).toEqual({
      params,
    });
  });

  it('percent encodes a space so the host router reads it back as a space', () => {
    const params = { mode: 'by_subject_id', selected_subject_name: 'a b+c' };
    const hash = hashOf(teachTableUrl(params));
    expect(hash).toBe(
      '#/teach_table?mode=by_subject_id&selected_subject_name=a%20b%2Bc',
    );
    const query = hash.slice(hash.indexOf('?') + 1);
    const decoded = query
      .split('&')
      .map((pair) => pair.split('=').map(decodeURIComponent));
    expect(Object.fromEntries(decoded)).toEqual(params);
    expect(parseTeachTableRoute(hash)).toEqual({ params });
  });

  it('encodes values so a reserved character cannot split a param', () => {
    const params = { mode: 'by_subject_id', selected_subject_id: 'a&b=c#d' };
    expect(parseTeachTableRoute(hashOf(teachTableUrl(params)))).toEqual({
      params,
    });
  });
});

describe('subjectListingUrl', () => {
  it('sends the by_subject_id params the subject id tab sends', () => {
    const url = subjectListingUrl(TERM, '90641007');
    expect(url).not.toBeNull();
    expect(parseTeachTableRoute(hashOf(url ?? ''))?.params).toEqual({
      mode: 'by_subject_id',
      selected_year: '2569',
      selected_semester: '1',
      search_all_faculty: 'true',
      search_all_department: 'true',
      search_all_curriculum: 'true',
      search_all_class_year: 'true',
      selected_subject_id: '90641007',
    });
  });

  it('reads back into the same subject id search and term', () => {
    const url = subjectListingUrl({ year: '2568', semester: '3' }, '90592033');
    const route = parseTeachTableRoute(hashOf(url ?? ''));
    const query = route === null ? null : sourceQueryToQuery(route.params);
    expect(query === null ? null : formsFromQuery(query)).toEqual({
      tab: 'by_subject_id',
      term: { year: '2568', semester: '3' },
      form: { subjectId: '90592033' },
    });
  });

  it('returns null for a subject id that is not 8 digits', () => {
    expect(subjectListingUrl(TERM, '9064100')).toBeNull();
    expect(subjectListingUrl(TERM, '')).toBeNull();
    expect(subjectListingUrl(TERM, '9064100x')).toBeNull();
  });
});
