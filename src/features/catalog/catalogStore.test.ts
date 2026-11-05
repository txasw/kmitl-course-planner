import { describe, it, expect } from 'vitest';
import { isCardOpen } from '@/lib/catalog/cardDisclosure';
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
});
