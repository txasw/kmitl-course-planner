import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/react';
import {
  HOVER_REST_MS,
  SCROLL_QUIET_MS,
  useHoverIntent,
} from './useHoverIntent';

interface ProbeProps {
  enabled?: boolean;
  showing?: boolean;
  onIntent: () => void;
  onClear?: () => void;
}

function Probe({
  enabled = true,
  showing = false,
  onIntent,
  onClear = () => undefined,
}: ProbeProps) {
  const handlers = useHoverIntent({ enabled, showing, onIntent, onClear });
  return (
    <div data-catalog-scroller>
      <div data-testid="target" {...handlers}>
        card
      </div>
    </div>
  );
}

function target(): HTMLElement {
  const node = document.querySelector<HTMLElement>('[data-testid="target"]');
  if (node === null) throw new Error('expected the target');
  return node;
}

function scroller(): HTMLElement {
  const node = document.querySelector<HTMLElement>('[data-catalog-scroller]');
  if (node === null) throw new Error('expected the scroller');
  return node;
}

function enter(x = 10, y = 10, pointerType = 'mouse'): void {
  fireEvent.pointerEnter(target(), { pointerType, clientX: x, clientY: y });
}

function move(x: number, y = 10, pointerType = 'mouse'): void {
  fireEvent.pointerMove(target(), {
    pointerType,
    clientX: x,
    clientY: y,
    buttons: 0,
  });
}

function rest(ms = HOVER_REST_MS): void {
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
});

describe('useHoverIntent', () => {
  it('does not fire without 3 px of movement from the entry point', () => {
    const onIntent = vi.fn();
    render(<Probe onIntent={onIntent} />);
    enter(10, 10);
    move(12, 10);
    rest(1000);
    expect(onIntent).not.toHaveBeenCalled();
  });

  it('fires after 120 ms of rest once armed', () => {
    const onIntent = vi.fn();
    render(<Probe onIntent={onIntent} />);
    enter(10, 10);
    move(14, 10);
    rest(HOVER_REST_MS - 1);
    expect(onIntent).not.toHaveBeenCalled();
    rest(1);
    expect(onIntent).toHaveBeenCalledTimes(1);
  });

  it('restarts the rest on every move', () => {
    const onIntent = vi.fn();
    render(<Probe onIntent={onIntent} />);
    enter(10, 10);
    move(14, 10);
    rest(100);
    move(15, 10);
    rest(100);
    expect(onIntent).not.toHaveBeenCalled();
    rest(20);
    expect(onIntent).toHaveBeenCalledTimes(1);
  });

  it('stays quiet within 150 ms of a scroll and clears on it', () => {
    const onIntent = vi.fn();
    const onClear = vi.fn();
    render(<Probe onIntent={onIntent} onClear={onClear} />);
    enter(10, 10);
    move(14, 10);
    fireEvent.scroll(scroller());
    expect(onClear).toHaveBeenCalledTimes(1);
    move(20, 10);
    move(30, 10);
    rest(HOVER_REST_MS);
    expect(onIntent).not.toHaveBeenCalled();
    rest(SCROLL_QUIET_MS);
    move(40, 10);
    rest(HOVER_REST_MS);
    expect(onIntent).toHaveBeenCalledTimes(1);
  });

  it.each(['touch', 'pen'])('never fires for a %s pointer', (pointerType) => {
    const onIntent = vi.fn();
    render(<Probe onIntent={onIntent} />);
    enter(10, 10, pointerType);
    move(20, 10, pointerType);
    move(30, 10, pointerType);
    rest(1000);
    expect(onIntent).not.toHaveBeenCalled();
  });

  it('clears and drops the rest on leave', () => {
    const onIntent = vi.fn();
    const onClear = vi.fn();
    render(<Probe onIntent={onIntent} onClear={onClear} />);
    enter(10, 10);
    move(14, 10);
    fireEvent.pointerLeave(target(), { pointerType: 'mouse' });
    rest(1000);
    expect(onIntent).not.toHaveBeenCalled();
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('clears on a press and ignores moves with a button held', () => {
    const onIntent = vi.fn();
    const onClear = vi.fn();
    render(<Probe onIntent={onIntent} onClear={onClear} />);
    enter(10, 10);
    move(14, 10);
    fireEvent.pointerDown(target(), {
      pointerType: 'mouse',
      clientX: 14,
      clientY: 10,
    });
    expect(onClear).toHaveBeenCalledTimes(1);
    fireEvent.pointerMove(target(), {
      pointerType: 'mouse',
      clientX: 30,
      clientY: 10,
      buttons: 1,
    });
    rest(1000);
    expect(onIntent).not.toHaveBeenCalled();
  });

  it('dismisses a showing result on Escape until the pointer enters again', () => {
    const onIntent = vi.fn();
    const onClear = vi.fn();
    render(<Probe showing onIntent={onIntent} onClear={onClear} />);
    enter(10, 10);
    fireEvent.keyDown(target(), { key: 'Escape' });
    expect(onClear).toHaveBeenCalledTimes(1);
    move(20, 10);
    rest(1000);
    expect(onIntent).not.toHaveBeenCalled();
    enter(20, 10);
    move(30, 10);
    rest(HOVER_REST_MS);
    expect(onIntent).toHaveBeenCalledTimes(1);
  });

  it('drops a pending rest when it is disabled', () => {
    const onIntent = vi.fn();
    const { rerender } = render(<Probe onIntent={onIntent} />);
    enter(10, 10);
    move(14, 10);
    rerender(<Probe enabled={false} onIntent={onIntent} />);
    rest(1000);
    expect(onIntent).not.toHaveBeenCalled();
  });
});
