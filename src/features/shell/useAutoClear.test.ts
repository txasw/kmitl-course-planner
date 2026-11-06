import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useAutoClear } from './useAutoClear';

const WINDOW_MS = 6_000;

interface Props {
  notice: unknown;
  paused: boolean;
  clear: () => void;
}

function renderAutoClear(initial: Props) {
  return renderHook(
    ({ notice, paused, clear }: Props) => {
      useAutoClear(notice, WINDOW_MS, clear, paused);
    },
    { initialProps: initial },
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useAutoClear', () => {
  it('clears a notice once its window has run', () => {
    const clear = vi.fn();
    renderAutoClear({ notice: { id: 1 }, paused: false, clear });
    vi.advanceTimersByTime(WINDOW_MS - 1);
    expect(clear).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('runs nothing while there is no notice', () => {
    const clear = vi.fn();
    renderAutoClear({ notice: null, paused: false, clear });
    vi.advanceTimersByTime(WINDOW_MS * 2);
    expect(clear).not.toHaveBeenCalled();
  });

  it('holds the window while paused', () => {
    const clear = vi.fn();
    const notice = { id: 1 };
    const { rerender } = renderAutoClear({ notice, paused: false, clear });
    rerender({ notice, paused: true, clear });
    vi.advanceTimersByTime(WINDOW_MS * 3);
    expect(clear).not.toHaveBeenCalled();
  });

  it('resumes with the time left rather than a full window', () => {
    const clear = vi.fn();
    const notice = { id: 1 };
    const { rerender } = renderAutoClear({ notice, paused: false, clear });
    vi.advanceTimersByTime(4_000);
    rerender({ notice, paused: true, clear });
    vi.advanceTimersByTime(10_000);
    rerender({ notice, paused: false, clear });
    vi.advanceTimersByTime(1_999);
    expect(clear).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('gives a new notice a full window of its own', () => {
    const clear = vi.fn();
    const { rerender } = renderAutoClear({
      notice: { id: 1 },
      paused: false,
      clear,
    });
    vi.advanceTimersByTime(5_000);
    rerender({ notice: { id: 2 }, paused: false, clear });
    vi.advanceTimersByTime(5_000);
    expect(clear).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000);
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('gives the same message shown again after it left a full window', () => {
    const clear = vi.fn();
    const { rerender } = renderAutoClear({
      notice: 'hint',
      paused: false,
      clear,
    });
    vi.advanceTimersByTime(WINDOW_MS);
    expect(clear).toHaveBeenCalledTimes(1);
    rerender({ notice: null, paused: false, clear });
    rerender({ notice: 'hint', paused: false, clear });
    vi.advanceTimersByTime(WINDOW_MS - 1);
    expect(clear).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(clear).toHaveBeenCalledTimes(2);
  });

  it('runs the latest clear callback without restarting the window', () => {
    const first = vi.fn();
    const latest = vi.fn();
    const notice = { id: 1 };
    const { rerender } = renderAutoClear({
      notice,
      paused: false,
      clear: first,
    });
    vi.advanceTimersByTime(3_000);
    rerender({ notice, paused: false, clear: latest });
    vi.advanceTimersByTime(3_000);
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);
  });

  it('clears nothing after unmount', () => {
    const clear = vi.fn();
    const { unmount } = renderAutoClear({
      notice: { id: 1 },
      paused: false,
      clear,
    });
    unmount();
    vi.advanceTimersByTime(WINDOW_MS * 2);
    expect(clear).not.toHaveBeenCalled();
  });
});
