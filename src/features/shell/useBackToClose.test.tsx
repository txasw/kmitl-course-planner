import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { OVERLAY_HISTORY_MARKER, useBackToClose } from './useBackToClose';

const HOST_HASH = '#/teach_table_selector';
const HOST_STATE = { key: '1234.567' };

function Harness({ active, onBack }: { active: boolean; onBack: () => void }) {
  useBackToClose(active, onBack);
  return null;
}

/** Resolve on the next popstate, the end of a queued traversal. */
function nextPopState(): Promise<void> {
  return new Promise((resolve) => {
    window.addEventListener(
      'popstate',
      () => {
        resolve();
      },
      { once: true },
    );
  });
}

function markerOf(state: unknown): unknown {
  return typeof state === 'object' &&
    state !== null &&
    OVERLAY_HISTORY_MARKER in state
    ? state[OVERLAY_HISTORY_MARKER]
    : undefined;
}

beforeEach(() => {
  window.history.replaceState(HOST_STATE, '', `/${HOST_HASH}`);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('useBackToClose', () => {
  it('pushes nothing while inactive', () => {
    const length = window.history.length;
    render(<Harness active={false} onBack={vi.fn()} />);
    expect(window.history.length).toBe(length);
    expect(window.history.state).toEqual(HOST_STATE);
  });

  it('pushes one same URL entry that keeps the host state and its key', async () => {
    const length = window.history.length;
    const url = window.location.href;
    const { unmount } = render(<Harness active={true} onBack={vi.fn()} />);
    expect(window.history.length).toBe(length + 1);
    expect(window.location.href).toBe(url);
    expect(window.history.state).toMatchObject(HOST_STATE);
    expect(typeof markerOf(window.history.state)).toBe('string');
    // Settle the back the close queues, so the next test starts on the host entry.
    const popped = nextPopState();
    unmount();
    await act(() => popped);
  });

  it('calls onBack on a back gesture and leaves the host entry on top', async () => {
    const onBack = vi.fn();
    const { rerender } = render(<Harness active={true} onBack={onBack} />);
    const popped = nextPopState();
    window.history.back();
    await act(() => popped);
    expect(onBack).toHaveBeenCalledTimes(1);
    rerender(<Harness active={false} onBack={onBack} />);
    expect(window.history.state).toEqual(HOST_STATE);
    expect(window.location.hash).toBe(HOST_HASH);
  });

  it('goes back once on a normal close and restores the host state', async () => {
    const onBack = vi.fn();
    const { rerender } = render(<Harness active={true} onBack={onBack} />);
    const popped = nextPopState();
    rerender(<Harness active={false} onBack={onBack} />);
    await act(() => popped);
    expect(onBack).not.toHaveBeenCalled();
    expect(window.history.state).toEqual(HOST_STATE);
    expect(window.location.hash).toBe(HOST_HASH);
  });

  it('goes back when unmounted while active', async () => {
    const { unmount } = render(<Harness active={true} onBack={vi.fn()} />);
    const popped = nextPopState();
    unmount();
    await act(() => popped);
    expect(window.history.state).toEqual(HOST_STATE);
  });

  it('leaves history alone when another entry was pushed on top', () => {
    const { rerender } = render(<Harness active={true} onBack={vi.fn()} />);
    const back = vi.spyOn(window.history, 'back');
    window.history.pushState({ key: '9.9' }, '', '/#/teach_table');
    rerender(<Harness active={false} onBack={vi.fn()} />);
    expect(back).not.toHaveBeenCalled();
    expect(window.history.state).toEqual({ key: '9.9' });
    back.mockRestore();
  });

  it.each([
    ['a string', 'host'],
    ['an array', ['host']],
  ])('pushes nothing when the host state is %s', (_label, hostState) => {
    window.history.replaceState(hostState, '');
    const length = window.history.length;
    const back = vi.spyOn(window.history, 'back');
    const { rerender } = render(<Harness active={true} onBack={vi.fn()} />);
    expect(window.history.length).toBe(length);
    rerender(<Harness active={false} onBack={vi.fn()} />);
    expect(back).not.toHaveBeenCalled();
    expect(window.history.state).toEqual(hostState);
    back.mockRestore();
  });

  // jsdom has no userActivation, so stand in a navigator that inherits the real one.
  function stubActivation(hasBeenActive: boolean, isActive: boolean): void {
    vi.stubGlobal(
      'navigator',
      Object.assign(Object.create(navigator), {
        userActivation: { hasBeenActive, isActive },
      }),
    );
  }

  it.each([
    ['the student has not interacted with the page', false],
    ['only an earlier interaction is on record', true],
  ])('pushes nothing when %s', (_label, hasBeenActive) => {
    stubActivation(hasBeenActive, false);
    const length = window.history.length;
    render(<Harness active={true} onBack={vi.fn()} />);
    expect(window.history.length).toBe(length);
    expect(window.history.state).toEqual(HOST_STATE);
  });

  it('pushes when the opening follows a fresh interaction', async () => {
    stubActivation(true, true);
    const length = window.history.length;
    const { unmount } = render(<Harness active={true} onBack={vi.fn()} />);
    expect(window.history.length).toBe(length + 1);
    const popped = nextPopState();
    unmount();
    await act(() => popped);
    expect(window.history.state).toEqual(HOST_STATE);
  });

  it('waits for a pending back before pushing for a reopening', async () => {
    const onBack = vi.fn();
    const { rerender } = render(<Harness active={true} onBack={onBack} />);
    const popped = nextPopState();
    rerender(<Harness active={false} onBack={onBack} />);
    rerender(<Harness active={true} onBack={onBack} />);
    // The reopening pushed nothing yet, so the host entry is still the one below.
    expect(markerOf(window.history.state)).toBeDefined();
    await act(() => popped);
    expect(onBack).not.toHaveBeenCalled();
    expect(window.history.state).toMatchObject(HOST_STATE);
    expect(typeof markerOf(window.history.state)).toBe('string');
    const closed = nextPopState();
    rerender(<Harness active={false} onBack={onBack} />);
    await act(() => closed);
    expect(window.history.state).toEqual(HOST_STATE);
  });
});
