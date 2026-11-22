import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useBusyAction } from './useBusyAction';

describe('useBusyAction', () => {
  it('names the running work and ignores a press until it settles', async () => {
    const { result } = renderHook(() => useBusyAction<'copy' | 'share'>());
    let settle: () => void = () => undefined;
    const work = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          settle = resolve;
        }),
    );
    const other = vi.fn(() => Promise.resolve());

    act(() => {
      result.current[1]('copy', work);
    });
    expect(result.current[0]).toBe('copy');
    act(() => {
      result.current[1]('share', other);
    });
    expect(other).not.toHaveBeenCalled();

    await act(async () => {
      settle();
      await Promise.resolve();
    });
    expect(result.current[0]).toBeNull();
    expect(work).toHaveBeenCalledTimes(1);
  });

  it('frees the controls when the work throws before it returns a promise', async () => {
    const { result } = renderHook(() => useBusyAction<'copy'>());
    const failure = new TypeError('no clipboard');

    act(() => {
      expect(() => {
        result.current[1]('copy', () => {
          throw failure;
        });
      }).toThrow(failure);
    });
    expect(result.current[0]).toBeNull();

    const next = vi.fn(() => Promise.resolve());
    await act(async () => {
      result.current[1]('copy', next);
      await Promise.resolve();
    });
    expect(next).toHaveBeenCalledTimes(1);
  });
});
