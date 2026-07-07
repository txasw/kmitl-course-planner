import { describe, it, expect } from 'vitest';
import { createUiStore } from './uiStore';

describe('ui store', () => {
  it('starts closed with the default locale', () => {
    const store = createUiStore();
    const state = store.getState();
    expect(state.isOpen).toBe(false);
    expect(state.drawerOpen).toBe(false);
    expect(state.language).toBe('th');
  });

  it('opens and closes', () => {
    const store = createUiStore();
    store.getState().open();
    expect(store.getState().isOpen).toBe(true);
    store.getState().close();
    expect(store.getState().isOpen).toBe(false);
  });

  it('toggles the open state', () => {
    const store = createUiStore();
    store.getState().toggle();
    expect(store.getState().isOpen).toBe(true);
    store.getState().toggle();
    expect(store.getState().isOpen).toBe(false);
  });

  it('resets the drawer when closing', () => {
    const store = createUiStore();
    store.getState().open();
    store.getState().setDrawer(true);
    expect(store.getState().drawerOpen).toBe(true);
    store.getState().close();
    expect(store.getState().drawerOpen).toBe(false);
  });

  it('sets the language', () => {
    const store = createUiStore();
    store.getState().setLanguage('en');
    expect(store.getState().language).toBe('en');
  });

  it('accepts an initial language', () => {
    expect(createUiStore('en').getState().language).toBe('en');
  });
});
