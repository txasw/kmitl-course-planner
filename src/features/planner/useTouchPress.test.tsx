import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/react';
import { dragSourceClass, useTouchPress } from './useTouchPress';

function Surface() {
  const press = useTouchPress();
  return (
    <div
      data-testid="surface"
      data-pressed={press.pressed}
      {...press.handlers}
    />
  );
}

function surface(): HTMLElement {
  const node = document.querySelector<HTMLElement>('[data-testid="surface"]');
  if (node === null) throw new Error('expected the surface');
  return node;
}

function touchDown(clientX = 10, clientY = 10): void {
  fireEvent.pointerDown(surface(), {
    pointerType: 'touch',
    isPrimary: true,
    clientX,
    clientY,
  });
}

function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useTouchPress', () => {
  it('marks a held finger pressed at 120 ms and clears on lift', () => {
    vi.useFakeTimers();
    render(<Surface />);
    touchDown();
    advance(119);
    expect(surface()).toHaveAttribute('data-pressed', 'false');
    advance(1);
    expect(surface()).toHaveAttribute('data-pressed', 'true');
    fireEvent.pointerUp(surface(), { pointerType: 'touch' });
    expect(surface()).toHaveAttribute('data-pressed', 'false');
  });

  it('treats a drift past the touch tolerance as a scroll', () => {
    vi.useFakeTimers();
    render(<Surface />);
    touchDown();
    fireEvent.pointerMove(surface(), {
      pointerType: 'touch',
      clientX: 15,
      clientY: 15,
    });
    advance(120);
    expect(surface()).toHaveAttribute('data-pressed', 'true');
    fireEvent.pointerMove(surface(), {
      pointerType: 'touch',
      clientX: 10,
      clientY: 20,
    });
    expect(surface()).toHaveAttribute('data-pressed', 'false');

    touchDown();
    fireEvent.pointerMove(surface(), {
      pointerType: 'touch',
      clientX: 30,
      clientY: 10,
    });
    advance(200);
    expect(surface()).toHaveAttribute('data-pressed', 'false');
  });

  it('clears when the browser takes the gesture with a pointer cancel', () => {
    vi.useFakeTimers();
    render(<Surface />);
    touchDown();
    advance(120);
    fireEvent.pointerCancel(surface(), { pointerType: 'touch' });
    expect(surface()).toHaveAttribute('data-pressed', 'false');
  });

  it('never marks a mouse press or a second finger', () => {
    vi.useFakeTimers();
    render(<Surface />);
    fireEvent.pointerDown(surface(), { pointerType: 'mouse', isPrimary: true });
    fireEvent.pointerDown(surface(), {
      pointerType: 'touch',
      isPrimary: false,
    });
    advance(300);
    expect(surface()).toHaveAttribute('data-pressed', 'false');
  });

  it('fires no timer after the surface unmounts mid press', () => {
    vi.useFakeTimers();
    const { unmount } = render(<Surface />);
    touchDown();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('dragSourceClass', () => {
  it('dims a dragging source, marks a pressed one, and leaves a resting one plain', () => {
    expect(dragSourceClass(true, true)).toBe('opacity-40');
    expect(dragSourceClass(false, true)).toContain('outline-border-strong');
    expect(dragSourceClass(false, true)).toContain('bg-surface-alt');
    expect(dragSourceClass(false, false)).toBe('');
  });
});
