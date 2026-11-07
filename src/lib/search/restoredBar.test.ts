import { describe, expect, it } from 'vitest';
import type { SearchState } from '../storage/lastSearch';
import {
  buildSubjectIdQuery,
  defaultCategoryForm,
  defaultClassForm,
} from './formState';
import { persistedBarQuery, restoredBar } from './restoredBar';

const term = { year: '2569', semester: '1' } as const;

function persisted(subjectId = '90592033'): SearchState {
  return {
    schemaVersion: 2,
    activeTab: 'by_subject_id',
    term,
    byClass: defaultClassForm(),
    bySubjectId: { subjectId },
    byCategory: defaultCategoryForm(),
  };
}

describe('persistedBarQuery', () => {
  it('builds the query of the active tab', () => {
    expect(persistedBarQuery(persisted())).toEqual(
      buildSubjectIdQuery(term, { subjectId: '90592033' }),
    );
  });

  it('is null with no persisted search or an incomplete active tab', () => {
    expect(persistedBarQuery(null)).toBeNull();
    expect(persistedBarQuery(persisted('9059'))).toBeNull();
  });
});

describe('restoredBar', () => {
  it('restores the bar seeded from the persisted search', () => {
    expect(restoredBar(persisted(), { term, source: 'persisted' })).toEqual(
      persistedBarQuery(persisted()),
    );
  });

  it('keeps the bar when the host route names the same term', () => {
    expect(
      restoredBar(persisted(), { term: { ...term }, source: 'route' }),
    ).not.toBeNull();
  });

  it('drops the bar when the host route names another term', () => {
    expect(
      restoredBar(persisted(), {
        term: { year: '2568', semester: '2' },
        source: 'route',
      }),
    ).toBeNull();
  });

  it('restores nothing without a persisted search', () => {
    expect(restoredBar(null, { term, source: 'fallback' })).toBeNull();
  });
});
