import { describe, it, expect } from 'vitest';
import { isCardInstant, isCardOpen } from '@/lib/catalog/cardDisclosure';
import { DEFAULT_COURSE_SORT } from '@/lib/catalog/sortCourses';
import { createCatalogStore } from './catalogStore';

describe('catalogStore disclosure', () => {
  it('holds a card choice for its query and keeps it across a filter reset', () => {
    const store = createCatalogStore();
    store.getState().setCardOpen('q1', 'S1', { open: true, added: false });
    store.getState().resetFilter();
    const { disclosure } = store.getState();
    expect(isCardOpen(disclosure, 'q1', 'S1', false, false)).toBe(true);
  });

  it('starts clean for a new query', () => {
    const store = createCatalogStore();
    store.getState().setCardOpen('q1', 'S1', { open: true, added: false });
    store.getState().setCardOpen('q2', 'S2', { open: true, added: false });
    const { disclosure } = store.getState();
    expect(disclosure.choices).toEqual({ S2: { open: true, added: false } });
  });

  it('keeps the disclosure identity when the placement leaves it unchanged', () => {
    const store = createCatalogStore();
    store.getState().setCardOpen('q1', 'S1', { open: true, added: false });
    const before = store.getState().disclosure;
    store.getState().syncPlacement(new Set());
    expect(store.getState().disclosure).toBe(before);
    store.getState().syncPlacement(new Set(['S1']));
    expect(store.getState().disclosure.choices).toEqual({});
  });

  it('opens every given card at once as a bulk change', () => {
    const store = createCatalogStore();
    store.getState().setAllCards(
      'q1',
      [
        { subjectId: 'S1', added: false },
        { subjectId: 'S2', added: false },
      ],
      true,
    );
    const { disclosure } = store.getState();
    expect(isCardInstant(disclosure, 'q1', 'S1')).toBe(true);
    expect(isCardOpen(disclosure, 'q1', 'S1', false, false)).toBe(true);
    expect(isCardOpen(disclosure, 'q1', 'S2', false, false)).toBe(true);
    store.getState().setCardOpen('q1', 'S1', { open: false, added: false });
    expect(isCardInstant(store.getState().disclosure, 'q1', 'S1')).toBe(false);
    expect(isCardInstant(store.getState().disclosure, 'q1', 'S2')).toBe(true);
  });
});

describe('catalogStore sort', () => {
  it('starts on the default sort and keeps a chosen sort past a filter reset', () => {
    const store = createCatalogStore();
    expect(store.getState().sort).toBe(DEFAULT_COURSE_SORT);
    store.getState().setSort('earliestStart');
    store.getState().resetFilter();
    expect(store.getState().sort).toBe('earliestStart');
  });
});
