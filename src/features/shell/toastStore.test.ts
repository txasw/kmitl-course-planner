import { describe, it, expect } from 'vitest';
import { createToastStore } from './toastStore';

describe('toastStore', () => {
  it('shows a toast and replaces it with the latest', () => {
    const store = createToastStore();
    store.getState().show('success', 'first');
    expect(store.getState().toast).toMatchObject({
      kind: 'success',
      message: 'first',
    });
    const firstId = store.getState().toast?.id;
    store.getState().show('error', 'second');
    expect(store.getState().toast).toMatchObject({
      kind: 'error',
      message: 'second',
    });
    expect(store.getState().toast?.id).not.toBe(firstId);
  });

  it('dismisses only when the id matches the current toast', () => {
    const store = createToastStore();
    store.getState().show('success', 'first');
    const firstId = store.getState().toast?.id ?? -1;
    // A replacement gives the successor a new id; the first toast's stale timer
    // must not dismiss it.
    store.getState().show('success', 'second');
    store.getState().dismiss(firstId);
    expect(store.getState().toast?.message).toBe('second');
    store.getState().dismiss(store.getState().toast?.id);
    expect(store.getState().toast).toBeNull();
  });

  it('carries one action when given and none otherwise', () => {
    const store = createToastStore();
    const action = { label: 'View', run: () => undefined };
    store.getState().show('success', 'with action', action);
    expect(store.getState().toast?.action).toBe(action);
    store.getState().show('success', 'plain');
    expect(store.getState().toast).not.toHaveProperty('action');
  });

  it('dismisses unconditionally without an id', () => {
    const store = createToastStore();
    store.getState().show('success', 'x');
    store.getState().dismiss();
    expect(store.getState().toast).toBeNull();
  });
});
