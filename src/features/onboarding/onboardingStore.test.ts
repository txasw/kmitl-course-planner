import { describe, expect, it } from 'vitest';
import type { InstallRecord } from '@/lib/storage/install';
import {
  createOnboardingStore,
  initialOnboardingData,
} from './onboardingStore';

const INSTALL: InstallRecord = {
  schemaVersion: 1,
  installedAt: '2026-11-06T08:00:00.000Z',
  version: '1.4.0',
};
const SHOWN = '2026-11-06T08:00:05.000Z';

describe('onboarding store', () => {
  it('starts unloaded, unsettled, closed and unsuppressed', () => {
    const store = createOnboardingStore();
    const { loaded, handshakeSettled, welcomeSettled, welcomeOpen } =
      store.getState();
    expect({ loaded, handshakeSettled, welcomeSettled, welcomeOpen }).toEqual({
      loaded: false,
      handshakeSettled: false,
      welcomeSettled: false,
      welcomeOpen: false,
    });
    expect(store.getState().documentSuppressed).toBe(false);
    expect(store.getState().record).toEqual({ schemaVersion: 1 });
    expect(store.getState().install).toBeNull();
    expect(store.getState().shortcut).toBeNull();
  });

  it('marks the welcome pending at load for an install with no welcome shown, which suppresses the document', () => {
    const store = createOnboardingStore();
    store.getState().hydrate(INSTALL, { schemaVersion: 1 });
    expect(store.getState().loaded).toBe(true);
    expect(store.getState().install).toEqual(INSTALL);
    expect(store.getState().welcomePendingAtLoad).toBe(true);
    expect(store.getState().documentSuppressed).toBe(true);
  });

  it('does not mark the welcome pending once it has been shown', () => {
    const store = createOnboardingStore();
    store.getState().hydrate(INSTALL, {
      schemaVersion: 1,
      welcomeShownAt: SHOWN,
    });
    expect(store.getState().welcomePendingAtLoad).toBe(false);
    expect(store.getState().documentSuppressed).toBe(false);
  });

  it('does not mark the welcome pending without an install record', () => {
    const store = createOnboardingStore();
    store.getState().hydrate(null, { schemaVersion: 1 });
    expect(store.getState().loaded).toBe(true);
    expect(store.getState().welcomePendingAtLoad).toBe(false);
    expect(store.getState().documentSuppressed).toBe(false);
  });

  it('judges the pending welcome from the first read only', () => {
    const store = createOnboardingStore();
    store.getState().hydrate(INSTALL, { schemaVersion: 1 });
    store.getState().hydrate(INSTALL, {
      schemaVersion: 1,
      welcomeShownAt: SHOWN,
    });
    expect(store.getState().welcomePendingAtLoad).toBe(true);
    expect(store.getState().record.welcomeShownAt).toBeUndefined();
  });

  it('keeps a suppression set before the read', () => {
    const store = createOnboardingStore();
    store.getState().suppressDocument();
    store.getState().hydrate(null, { schemaVersion: 1 });
    expect(store.getState().documentSuppressed).toBe(true);
  });

  it('marks a requested open, which also suppresses the document', () => {
    const store = createOnboardingStore();
    expect(store.getState().openRequested).toBe(false);
    store.getState().markOpenRequested();
    expect(store.getState().openRequested).toBe(true);
    expect(store.getState().documentSuppressed).toBe(true);
  });

  it('updates the record, the settled flags, the welcome and the shortcut', () => {
    const store = createOnboardingStore();
    store.getState().setRecord({ schemaVersion: 1, welcomeShownAt: SHOWN });
    store.getState().settleHandshake();
    store.getState().settleWelcome();
    store.getState().setWelcomeOpen(true);
    store.getState().setShortcut('Alt+Shift+P');
    const state = store.getState();
    expect(state.record.welcomeShownAt).toBe(SHOWN);
    expect(state.handshakeSettled).toBe(true);
    expect(state.welcomeSettled).toBe(true);
    expect(state.welcomeOpen).toBe(true);
    expect(state.shortcut).toBe('Alt+Shift+P');
  });

  it('resets to the initial data through setState', () => {
    const store = createOnboardingStore();
    store.getState().hydrate(INSTALL, { schemaVersion: 1 });
    store.setState(initialOnboardingData());
    expect(store.getState().loaded).toBe(false);
    expect(store.getState().documentSuppressed).toBe(false);
  });
});
