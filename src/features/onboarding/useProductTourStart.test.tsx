import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { TOUR_START_DELAY_MS, TOUR_VERSION } from '@/lib/onboarding/tour';
import { attentionStore } from '@/features/shell/attentionStore';
import { uiStore } from '@/features/shell/uiStore';
import { initialOnboardingData, onboardingStore } from './onboardingStore';
import { useProductTourStart } from './useProductTourStart';

const AT = '2026-11-20T08:00:00.000Z';

function load(seenVersion?: number): void {
  onboardingStore.getState().hydrate(null, {
    schemaVersion: 1,
    ...(seenVersion === undefined
      ? {}
      : {
          tourSeen: { version: seenVersion, outcome: 'completed', at: AT },
        }),
  });
}

function wait(ms = TOUR_START_DELAY_MS): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  act(() => {
    uiStore.getState().close();
    uiStore.getState().setViewMode('edit');
  });
  onboardingStore.setState(initialOnboardingData());
  attentionStore.setState({ openSurfaces: 0, searchFocused: false });
});

describe('useProductTourStart', () => {
  it('starts the tour after the settle once the panel opens with no tour seen', () => {
    load();
    renderHook(() => {
      useProductTourStart();
    });
    act(() => {
      uiStore.getState().open();
    });
    wait(TOUR_START_DELAY_MS - 1);
    expect(onboardingStore.getState().tourOpen).toBe(false);
    wait(1);
    expect(onboardingStore.getState().tourOpen).toBe(true);
  });

  it('starts it for a student whose mark names an earlier tour', () => {
    load(TOUR_VERSION - 1);
    renderHook(() => {
      useProductTourStart();
    });
    act(() => {
      uiStore.getState().open();
    });
    wait();
    expect(onboardingStore.getState().tourOpen).toBe(true);
  });

  it('stays away once this tour ended', () => {
    load(TOUR_VERSION);
    renderHook(() => {
      useProductTourStart();
    });
    act(() => {
      uiStore.getState().open();
    });
    wait();
    expect(onboardingStore.getState().tourOpen).toBe(false);
  });

  it('waits for the record to be read', () => {
    renderHook(() => {
      useProductTourStart();
    });
    act(() => {
      uiStore.getState().open();
    });
    wait();
    expect(onboardingStore.getState().tourOpen).toBe(false);
    act(() => {
      load();
    });
    wait();
    expect(onboardingStore.getState().tourOpen).toBe(true);
  });

  it('waits while a dialog holds the panel and restarts the settle after it', () => {
    load();
    renderHook(() => {
      useProductTourStart();
    });
    let release = (): void => undefined;
    act(() => {
      uiStore.getState().open();
      release = attentionStore.getState().openSurface();
    });
    wait();
    expect(onboardingStore.getState().tourOpen).toBe(false);
    act(() => {
      release();
    });
    wait(TOUR_START_DELAY_MS - 1);
    expect(onboardingStore.getState().tourOpen).toBe(false);
    wait(1);
    expect(onboardingStore.getState().tourOpen).toBe(true);
  });

  it('waits on the export page and while the welcome is open', () => {
    load();
    renderHook(() => {
      useProductTourStart();
    });
    act(() => {
      onboardingStore.getState().setWelcomeOpen(true);
    });
    wait();
    expect(onboardingStore.getState().tourOpen).toBe(false);
    act(() => {
      onboardingStore.getState().setWelcomeOpen(false);
      uiStore.getState().open();
      uiStore.getState().setViewMode('preview');
    });
    wait();
    expect(onboardingStore.getState().tourOpen).toBe(false);
  });

  it('ends a tour the panel close cuts short and does not start it again here', () => {
    load();
    renderHook(() => {
      useProductTourStart();
    });
    act(() => {
      uiStore.getState().open();
    });
    wait();
    expect(onboardingStore.getState().tourOpen).toBe(true);
    act(() => {
      uiStore.getState().close();
    });
    expect(onboardingStore.getState().tourOpen).toBe(false);
    act(() => {
      uiStore.getState().open();
    });
    wait();
    expect(onboardingStore.getState().tourOpen).toBe(false);
  });
});
