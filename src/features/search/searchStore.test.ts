import { describe, expect, it } from 'vitest';
import type { Term } from '@/lib/routing/academicTerms';
import { createSearchStore } from './searchStore';

const fallback: Term = { year: '2570', semester: '1' };
const fetched: Term = { year: '2569', semester: '2' };

function yearsAndSemesters(store: ReturnType<typeof createSearchStore>) {
  const { byClass, bySubjectId, byCategory } = store.getState();
  return [byClass, bySubjectId, byCategory].map(
    (form) => `${form.semester}/${form.year}`,
  );
}

describe('the fetched default term', () => {
  it('replaces an untouched fallback in every tab', () => {
    const store = createSearchStore();
    store.getState().seedFallbackTerm(fallback);
    store.getState().applyDefaultTerm(fetched);
    expect(yearsAndSemesters(store)).toEqual(['2/2569', '2/2569', '2/2569']);
    expect(store.getState().defaultTermPending).toBe(false);
  });

  it('is ignored once the student edits a term field', () => {
    const store = createSearchStore();
    store.getState().seedFallbackTerm(fallback);
    store.getState().patchCategoryForm({ year: '2570' });
    store.getState().applyDefaultTerm(fetched);
    expect(yearsAndSemesters(store)).toEqual(['1/2570', '1/2570', '1/2570']);
  });

  it('survives an edit that leaves the term alone', () => {
    const store = createSearchStore();
    store.getState().seedFallbackTerm(fallback);
    store.getState().patchClassForm({ faculty: '01' });
    store.getState().applyDefaultTerm(fetched);
    expect(yearsAndSemesters(store)).toEqual(['2/2569', '2/2569', '2/2569']);
  });

  it('is ignored after another source seeds the term', () => {
    const store = createSearchStore();
    store.getState().seedFallbackTerm(fallback);
    store.getState().seedTerm({ year: '2568', semester: '3' });
    store.getState().applyDefaultTerm(fetched);
    expect(yearsAndSemesters(store)).toEqual(['3/2568', '3/2568', '3/2568']);
  });

  it('never applies without a pending fallback', () => {
    const store = createSearchStore();
    store.getState().seedTerm(fallback);
    store.getState().applyDefaultTerm(fetched);
    expect(yearsAndSemesters(store)).toEqual(['1/2570', '1/2570', '1/2570']);
  });
});
