import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useIsPast } from './useIsPast';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useIsPast', () => {
  it('turns true once the moment arrives', () => {
    const { result } = renderHook(() => useIsPast(1_060_000));
    expect(result.current).toBe(false);
    act(() => {
      vi.advanceTimersByTime(59_999);
    });
    expect(result.current).toBe(false);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(true);
  });

  it('reads a moment already gone as past at once', () => {
    const { result } = renderHook(() => useIsPast(999_000));
    expect(result.current).toBe(true);
  });

  it('reads no moment as not past', () => {
    const { result } = renderHook(() => useIsPast(null));
    expect(result.current).toBe(false);
  });

  it('rearms for a later moment after an earlier one passed', () => {
    const { result, rerender } = renderHook(({ at }) => useIsPast(at), {
      initialProps: { at: 1_010_000 },
    });
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current).toBe(true);
    rerender({ at: 1_070_000 });
    expect(result.current).toBe(false);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toBe(true);
  });
});
