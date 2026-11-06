import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { TeachTableQuery } from '../messaging/protocol';
import { parseTeachTableRoute } from '../routing/parseTeachTableRoute';
import {
  buildCategoryQuery,
  buildClassQuery,
  buildSubjectIdQuery,
  buildTeachTableQueryForTab,
  defaultCategoryForm,
  defaultClassForm,
  defaultSubjectIdForm,
  type SearchForms,
} from './formState';
import {
  applyPrefillForms,
  formsFromQuery,
  routeSearchPrefill,
  type SearchPrefill,
} from './queryForms';

const term = { year: '2569', semester: '1' } as const;

function emptyForms(): SearchForms {
  return {
    byClass: defaultClassForm(),
    bySubjectId: defaultSubjectIdForm(),
    byCategory: defaultCategoryForm(),
  };
}

function rebuild(prefill: SearchPrefill | null): TeachTableQuery | null {
  if (prefill === null) {
    return null;
  }
  return buildTeachTableQueryForTab(
    prefill.tab,
    prefill.term,
    applyPrefillForms(prefill, emptyForms()),
  );
}

// The browser records the page address in the saved snapshot's header comment.
function savedResultHash(): string {
  const html = readFileSync(
    resolve(
      process.cwd(),
      'tests/fixtures/host-dom/teach-table-result.snapshot.html',
    ),
    'utf8',
  );
  const url = /saved from url=\(\d+\)(\S+) -->/.exec(html)?.[1];
  if (url === undefined) {
    throw new Error('the snapshot carries no saved url');
  }
  return new URL(url).hash;
}

describe('routeSearchPrefill', () => {
  it('maps the saved result route to the category tab', () => {
    const route = parseTeachTableRoute(savedResultHash());
    expect(route).not.toBeNull();
    expect(route === null ? null : routeSearchPrefill(route)).toEqual({
      tab: 'by_subject_owner_id',
      term: { year: '2569', semester: '1' },
      form: { faculty: '01', subjectOwner: '46' },
    });
  });

  it('ignores route params the query does not know', () => {
    expect(
      routeSearchPrefill({
        params: {
          mode: 'by_subject_id',
          selected_year: '2569',
          selected_semester: '2',
          search_all_faculty: 'true',
          search_all_department: 'true',
          search_all_curriculum: 'true',
          search_all_class_year: 'true',
          selected_subject_id: '90592033',
          page: '3',
        },
      }),
    ).toEqual({
      tab: 'by_subject_id',
      term: { year: '2569', semester: '2' },
      form: { subjectId: '90592033' },
    });
  });

  it('returns null for a route without a mode', () => {
    expect(
      routeSearchPrefill({
        params: {
          selected_year: '2569',
          selected_semester: '1',
          selected_faculty: '01',
          search_all_faculty: 'false',
          selected_subject_owner_id: '46',
        },
      }),
    ).toBeNull();
  });
});

describe('formsFromQuery round trip', () => {
  const classForm = {
    faculty: '01',
    department: '08',
    curriculum: '08',
    classYear: '4',
  } as const;

  const queries: [string, TeachTableQuery][] = [
    ['a by_class query', buildClassQuery(term, classForm)],
    [
      'a by_class query for all class years',
      buildClassQuery(term, { ...classForm, classYear: 'all' }),
    ],
    [
      'a by_class query for all curricula',
      buildClassQuery(term, { ...classForm, curriculum: 'all' }),
    ],
    [
      'a by_class query for all curricula and class years',
      buildClassQuery(term, {
        ...classForm,
        curriculum: 'all',
        classYear: 'all',
      }),
    ],
    [
      // The curriculum capture lists an active curriculum under department 0.
      'a by_class query under department 0',
      buildClassQuery(term, {
        faculty: '95',
        department: '0',
        curriculum: '720',
        classYear: '1',
      }),
    ],
    [
      'a by_subject_id query',
      buildSubjectIdQuery(term, { subjectId: '90592033' }),
    ],
    [
      'a by_subject_owner_id query',
      buildCategoryQuery(term, { faculty: '01', subjectOwner: '32' }),
    ],
    [
      'a by_subject_owner_id query for all faculties',
      buildCategoryQuery(term, { faculty: 'all', subjectOwner: '32' }),
    ],
  ];

  it.each(queries)('rebuilds %s', (_name, query) => {
    expect(rebuild(formsFromQuery(query))).toEqual(query);
  });

  it('reads the sentinels back as the all options', () => {
    const query = buildClassQuery(term, {
      ...classForm,
      curriculum: 'all',
      classYear: 'all',
    });
    expect(formsFromQuery(query)).toEqual({
      tab: 'by_class',
      term,
      form: { ...classForm, curriculum: 'all', classYear: 'all' },
    });
  });
});

describe('formsFromQuery rejects shapes the form cannot build', () => {
  // Written out, since a builder returns the whole union and a spread over it widens.
  const byClass: Extract<TeachTableQuery, { mode: 'by_class' }> = {
    mode: 'by_class',
    selected_year: '2569',
    selected_semester: '1',
    selected_faculty: '01',
    selected_department: '08',
    selected_curriculum: '08',
    selected_class_year: '4',
    search_all_faculty: false,
    search_all_department: false,
    search_all_curriculum: false,
    search_all_class_year: false,
  };

  it('rejects the retired by_class all faculties search', () => {
    expect(formsFromQuery({ ...byClass, search_all_faculty: true })).toBeNull();
  });

  it('rejects the retired by_class all departments search', () => {
    expect(
      formsFromQuery({ ...byClass, search_all_department: true }),
    ).toBeNull();
  });

  it('rejects a sentinel select without its flag', () => {
    expect(formsFromQuery({ ...byClass, selected_class_year: '0' })).toBeNull();
    expect(formsFromQuery({ ...byClass, selected_curriculum: 'x' })).toBeNull();
    expect(formsFromQuery({ ...byClass, selected_department: 'x' })).toBeNull();
  });

  it('rejects a class year outside 1 to 8', () => {
    expect(formsFromQuery({ ...byClass, selected_class_year: '9' })).toBeNull();
  });

  it('rejects a 7 digit subject id', () => {
    expect(
      formsFromQuery(buildSubjectIdQuery(term, { subjectId: '9059203' })),
    ).toBeNull();
  });

  it('rejects a subject id search that does not search everything', () => {
    expect(
      formsFromQuery({
        mode: 'by_subject_id',
        selected_year: '2569',
        selected_semester: '1',
        search_all_faculty: true,
        search_all_department: true,
        search_all_curriculum: true,
        search_all_class_year: false,
        selected_subject_id: '90592033',
      }),
    ).toBeNull();
  });

  it('rejects a category search without a faculty or a subject owner', () => {
    const category: TeachTableQuery = {
      mode: 'by_subject_owner_id',
      selected_year: '2569',
      selected_semester: '1',
      selected_faculty: '01',
      search_all_faculty: false,
      selected_subject_owner_id: '',
    };
    expect(formsFromQuery(category)).toBeNull();
    // A specific faculty search that lost its faculty select.
    expect(
      formsFromQuery({
        mode: 'by_subject_owner_id',
        selected_year: '2569',
        selected_semester: '1',
        search_all_faculty: false,
        selected_subject_owner_id: '32',
      }),
    ).toBeNull();
  });

  it('rejects semester 4 and a malformed year', () => {
    expect(formsFromQuery({ ...byClass, selected_semester: '4' })).toBeNull();
    expect(formsFromQuery({ ...byClass, selected_year: '' })).toBeNull();
    expect(formsFromQuery({ ...byClass, selected_year: '69' })).toBeNull();
  });
});

describe('applyPrefillForms', () => {
  it('replaces only the prefilled tab form', () => {
    const forms: SearchForms = {
      byClass: {
        faculty: '01',
        department: '08',
        curriculum: '08',
        classYear: '4',
      },
      bySubjectId: { subjectId: '90592033' },
      byCategory: { faculty: '01', subjectOwner: '32' },
    };
    expect(
      applyPrefillForms(
        {
          tab: 'by_subject_owner_id',
          term,
          form: { faculty: 'all', subjectOwner: '6' },
        },
        forms,
      ),
    ).toEqual({
      ...forms,
      byCategory: { faculty: 'all', subjectOwner: '6' },
    });
  });
});
