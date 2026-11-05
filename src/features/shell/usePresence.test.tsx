import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { usePrefersReducedMotion, usePresence } from './usePresence';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('usePresence', () => {
  it('is mounted and open when it starts open', () => {
    const { result } = renderHook(({ open }) => usePresence(open, 100), {
      initialProps: { open: true },
    });
    expect(result.current.mounted).toBe(true);
    expect(result.current.stage).toBe('open');
  });

  it('is unmounted when it starts closed', () => {
    const { result } = renderHook(({ open }) => usePresence(open, 100), {
      initialProps: { open: false },
    });
    expect(result.current.mounted).toBe(false);
    expect(result.current.stage).toBe('closed');
  });

  it('enters when opening', () => {
    const { result, rerender } = renderHook(
      ({ open }) => usePresence(open, 100),
      {
        initialProps: { open: false },
      },
    );
    rerender({ open: true });
    expect(result.current.mounted).toBe(true);
    expect(result.current.stage).toBe('entering');
  });

  it('stays mounted while leaving, then unmounts after the duration', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ open }) => usePresence(open, 100),
      {
        initialProps: { open: true },
      },
    );
    rerender({ open: false });
    expect(result.current.stage).toBe('leaving');
    expect(result.current.mounted).toBe(true);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.stage).toBe('closed');
    expect(result.current.mounted).toBe(false);
  });

  it('opens and closes instantly under reduced motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }));
    const { result, rerender } = renderHook(
      ({ open }) => usePresence(open, 100),
      {
        initialProps: { open: false },
      },
    );
    rerender({ open: true });
    expect(result.current.stage).toBe('open');
    rerender({ open: false });
    expect(result.current.stage).toBe('closed');
  });

  it('follows a reduced motion change made while mounted', () => {
    let reduced = false;
    const listeners = new Set<() => void>();
    vi.stubGlobal('matchMedia', (query: string) => ({
      get matches() {
        return reduced;
      },
      media: query,
      onchange: null,
      addEventListener: (_type: string, listener: () => void) => {
        listeners.add(listener);
      },
      removeEventListener: (_type: string, listener: () => void) => {
        listeners.delete(listener);
      },
      dispatchEvent: () => false,
    }));
    const { result, rerender } = renderHook(
      ({ open }) => ({
        reduced: usePrefersReducedMotion(),
        presence: usePresence(open, 100),
      }),
      { initialProps: { open: true } },
    );
    expect(result.current.reduced).toBe(false);
    act(() => {
      reduced = true;
      for (const listener of listeners) listener();
    });
    expect(result.current.reduced).toBe(true);
    // With motion now reduced, closing skips the leave stage.
    rerender({ open: false });
    expect(result.current.presence.stage).toBe('closed');
  });
});
