import { describe, it, expect } from 'vitest';
import { createUiStore } from './uiStore';

describe('ui store', () => {
  it('starts closed with the default locale', () => {
    const store = createUiStore();
    const state = store.getState();
    expect(state.isOpen).toBe(false);
    expect(state.sheetOpen).toBe(false);
    expect(state.catalogVisible).toBe(true);
    expect(state.language).toBe('th');
  });

  it('hides and shows the docked catalog column', () => {
    const store = createUiStore();
    store.getState().setCatalogVisible(false);
    expect(store.getState().catalogVisible).toBe(false);
    store.getState().setCatalogVisible(true);
    expect(store.getState().catalogVisible).toBe(true);
  });

  it('keeps the catalog column choice across closing and reopening', () => {
    const store = createUiStore();
    store.getState().open();
    store.getState().setCatalogVisible(false);
    store.getState().close();
    store.getState().open();
    expect(store.getState().catalogVisible).toBe(false);
  });

  it('shows the docked column when the sheet opens', () => {
    const store = createUiStore();
    store.getState().setCatalogVisible(false);
    store.getState().setSheetOpen(true);
    expect(store.getState().sheetOpen).toBe(true);
    expect(store.getState().catalogVisible).toBe(true);
  });

  it('leaves the docked column choice alone when the sheet closes', () => {
    const store = createUiStore();
    store.getState().setSheetOpen(true);
    store.getState().setCatalogVisible(false);
    store.getState().setSheetOpen(false);
    expect(store.getState().sheetOpen).toBe(false);
    expect(store.getState().catalogVisible).toBe(false);
  });

  it('starts on the timetable view and switches to the selected view', () => {
    const store = createUiStore();
    expect(store.getState().planView).toBe('timetable');
    store.getState().setPlanView('selected');
    expect(store.getState().planView).toBe('selected');
  });

  it('keeps the plan view across closing and reopening', () => {
    const store = createUiStore();
    store.getState().open();
    store.getState().setPlanView('selected');
    store.getState().close();
    store.getState().open();
    expect(store.getState().planView).toBe('selected');
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

  it('resets the catalog sheet when closing', () => {
    const store = createUiStore();
    store.getState().open();
    store.getState().setSheetOpen(true);
    expect(store.getState().sheetOpen).toBe(true);
    store.getState().close();
    expect(store.getState().sheetOpen).toBe(false);
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
