import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { usePresence } from './usePresence';

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
});
