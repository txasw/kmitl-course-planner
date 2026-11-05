import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useElementSize } from './useElementSize';

// A ResizeObserver fake that records each live observer, so a test can resize an element
// and then fire the callback the way the browser would after layout.
class ResizeObserverFake {
  static live = new Set<ResizeObserverFake>();
  readonly observed = new Set<Element>();

  constructor(private readonly callback: () => void) {
    ResizeObserverFake.live.add(this);
  }

  observe(target: Element): void {
    this.observed.add(target);
  }

  unobserve(target: Element): void {
    this.observed.delete(target);
  }

  disconnect(): void {
    this.observed.clear();
    ResizeObserverFake.live.delete(this);
  }

  static fire(): void {
    for (const observer of ResizeObserverFake.live) observer.callback();
  }
}

// jsdom performs no layout, so the client box is set by hand.
function setClientBox(node: HTMLElement, width: number, height: number): void {
  Object.defineProperty(node, 'clientWidth', {
    configurable: true,
    value: width,
  });
  Object.defineProperty(node, 'clientHeight', {
    configurable: true,
    value: height,
  });
}

function observedNode(width: number, height: number) {
  const node = document.createElement('div');
  setClientBox(node, width, height);
  return { node, ref: { current: node } };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  ResizeObserverFake.live.clear();
});

describe('useElementSize', () => {
  it('measures on mount and follows later resizes', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverFake);
    const { node, ref } = observedNode(800, 600);
    const { result } = renderHook(() => useElementSize(ref));
    expect(result.current).toEqual({ width: 800, height: 600 });
    setClientBox(node, 1024, 480);
    act(() => {
      ResizeObserverFake.fire();
    });
    expect(result.current).toEqual({ width: 1024, height: 480 });
  });

  it('keeps the same size object when a resize reports the same box', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverFake);
    const { ref } = observedNode(640, 360);
    const { result } = renderHook(() => useElementSize(ref));
    const settled = result.current;
    act(() => {
      ResizeObserverFake.fire();
    });
    expect(result.current).toBe(settled);
  });

  it('stays unmeasured when the ref holds no element', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverFake);
    const { result } = renderHook(() => useElementSize({ current: null }));
    expect(result.current).toEqual({ width: 0, height: 0 });
    expect(ResizeObserverFake.live.size).toBe(0);
  });

  it('disconnects its observer on unmount', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverFake);
    const { ref } = observedNode(640, 360);
    const { unmount } = renderHook(() => useElementSize(ref));
    expect(ResizeObserverFake.live.size).toBe(1);
    unmount();
    expect(ResizeObserverFake.live.size).toBe(0);
  });
});
