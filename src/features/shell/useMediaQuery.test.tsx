import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useMediaQuery } from './useMediaQuery';

// A controllable matchMedia fake: each query string has one match flag that a test flips,
// which notifies that query's change listeners the way a real MediaQueryList does.
function installMatchMediaFake(initial: Record<string, boolean>) {
  const matches = new Map(Object.entries(initial));
  const listeners = new Map<string, Set<() => void>>();
  const listenersFor = (query: string): Set<() => void> => {
    const existing = listeners.get(query);
    if (existing !== undefined) return existing;
    const created = new Set<() => void>();
    listeners.set(query, created);
    return created;
  };
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return matches.get(query) ?? false;
    },
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: () => void) => {
      listenersFor(query).add(listener);
    },
    removeEventListener: (_type: string, listener: () => void) => {
      listenersFor(query).delete(listener);
    },
    dispatchEvent: () => false,
  }));
  return {
    set(query: string, value: boolean) {
      matches.set(query, value);
      for (const listener of listenersFor(query)) listener();
    },
    listenerCount(query: string): number {
      return listenersFor(query).size;
    },
  };
}

const WIDE = '(min-width: 1024px)';
const COMPACT = '(max-width: 639px)';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('useMediaQuery', () => {
  it('reports the current match on the first render', () => {
    installMatchMediaFake({ [WIDE]: true });
    const { result } = renderHook(() => useMediaQuery(WIDE));
    expect(result.current).toBe(true);
  });

  it('re-renders when the query starts or stops matching', () => {
    const fake = installMatchMediaFake({ [WIDE]: false });
    const { result } = renderHook(() => useMediaQuery(WIDE));
    expect(result.current).toBe(false);
    act(() => {
      fake.set(WIDE, true);
    });
    expect(result.current).toBe(true);
    act(() => {
      fake.set(WIDE, false);
    });
    expect(result.current).toBe(false);
  });

  it('follows a new query string and drops the old subscription', () => {
    const fake = installMatchMediaFake({ [WIDE]: false, [COMPACT]: true });
    const { result, rerender } = renderHook(
      ({ query }) => useMediaQuery(query),
      { initialProps: { query: WIDE } },
    );
    expect(result.current).toBe(false);
    rerender({ query: COMPACT });
    expect(result.current).toBe(true);
    expect(fake.listenerCount(WIDE)).toBe(0);
    expect(fake.listenerCount(COMPACT)).toBe(1);
  });

  it('removes its listener on unmount', () => {
    const fake = installMatchMediaFake({ [WIDE]: false });
    const { unmount } = renderHook(() => useMediaQuery(WIDE));
    expect(fake.listenerCount(WIDE)).toBe(1);
    unmount();
    expect(fake.listenerCount(WIDE)).toBe(0);
  });
});
