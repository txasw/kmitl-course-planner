import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { createRoot } from 'react-dom/client';
import { useRef } from 'react';
import {
  VIEWPORT_BOTTOM_PROPERTY,
  VIEWPORT_TOP_PROPERTY,
} from '@/lib/ui/viewportInset';
import { useVisualViewportInset } from './useVisualViewportInset';

const LAYOUT_HEIGHT = 844;

// A stand in for window.visualViewport, which jsdom does not implement: the fields the
// hook reads and the resize and scroll events a phone browser fires as its keyboard
// opens and as it pans the visual viewport.
class FakeVisualViewport extends EventTarget {
  offsetTop = 0;
  height = LAYOUT_HEIGHT;
  scale = 1;

  move(next: { offsetTop?: number; height?: number }, type: string): void {
    this.offsetTop = next.offsetTop ?? this.offsetTop;
    this.height = next.height ?? this.height;
    act(() => {
      this.dispatchEvent(new Event(type));
    });
  }
}

function Panel({ active = true }: { active?: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useVisualViewportInset(ref, active);
  return (
    <div ref={ref} data-testid="panel">
      <input aria-label="Curriculum" />
      <button type="button">Search</button>
    </div>
  );
}

let viewport: FakeVisualViewport;
const scrollIntoView = vi.fn();
const nativeScrollIntoView = Object.getOwnPropertyDescriptor(
  Element.prototype,
  'scrollIntoView',
);

beforeEach(() => {
  viewport = new FakeVisualViewport();
  vi.stubGlobal('visualViewport', viewport);
  Object.defineProperty(document.documentElement, 'clientHeight', {
    configurable: true,
    value: LAYOUT_HEIGHT,
  });
  scrollIntoView.mockReset();
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document.documentElement, 'clientHeight');
  if (nativeScrollIntoView === undefined) {
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
  } else {
    Object.defineProperty(
      Element.prototype,
      'scrollIntoView',
      nativeScrollIntoView,
    );
  }
});

function insetOf(node: HTMLElement) {
  return {
    top: node.style.getPropertyValue(VIEWPORT_TOP_PROPERTY),
    bottom: node.style.getPropertyValue(VIEWPORT_BOTTOM_PROPERTY),
  };
}

describe('useVisualViewportInset', () => {
  it('sets no inset while the visual viewport fills the layout viewport', () => {
    const { getByTestId } = render(<Panel />);
    expect(insetOf(getByTestId('panel'))).toEqual({ top: '', bottom: '' });
  });

  it('insets the panel foot by the band an open keyboard covers', () => {
    const { getByTestId } = render(<Panel />);
    viewport.move({ height: 420 }, 'resize');
    expect(insetOf(getByTestId('panel'))).toEqual({
      top: '0px',
      bottom: '424px',
    });
    viewport.move({ height: LAYOUT_HEIGHT }, 'resize');
    expect(insetOf(getByTestId('panel'))).toEqual({
      top: '0px',
      bottom: '0px',
    });
  });

  it('follows the browser panning the visual viewport', () => {
    const { getByTestId } = render(<Panel />);
    viewport.move({ height: 420 }, 'resize');
    viewport.move({ offsetTop: 100 }, 'scroll');
    expect(insetOf(getByTestId('panel'))).toEqual({
      top: '100px',
      bottom: '324px',
    });
  });

  it('reads an inset already open when the panel mounts', () => {
    viewport.height = 500;
    const { getByTestId } = render(<Panel />);
    expect(insetOf(getByTestId('panel')).bottom).toBe('344px');
  });

  it('scrolls the focused field into view when the visible area shrinks', () => {
    const { getByLabelText } = render(<Panel />);
    const field = getByLabelText('Curriculum');
    field.focus();
    viewport.move({ height: 420 }, 'resize');
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toBe(field);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
    // The keyboard closing gives the field more room, so nothing scrolls.
    viewport.move({ height: LAYOUT_HEIGHT }, 'resize');
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('leaves the scroll alone when focus is not on a text field', () => {
    const { getByRole } = render(<Panel />);
    getByRole('button', { name: 'Search' }).focus();
    viewport.move({ height: 420 }, 'resize');
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('finds the focused field inside a closed shadow root', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const shadow = host.attachShadow({ mode: 'closed' });
    const mount = document.createElement('div');
    shadow.append(mount);
    const root = createRoot(mount);
    act(() => {
      root.render(<Panel />);
    });
    const field = shadow.querySelector('input');
    if (field === null) throw new Error('no field');
    field.focus();
    viewport.move({ height: 420 }, 'resize');
    expect(scrollIntoView.mock.contexts[0]).toBe(field);
    act(() => {
      root.unmount();
    });
    host.remove();
  });

  it('clears the inset when it turns inactive or unmounts', () => {
    viewport.height = 420;
    const { getByTestId, rerender, unmount } = render(<Panel />);
    const panel = getByTestId('panel');
    expect(insetOf(panel).bottom).toBe('424px');
    rerender(<Panel active={false} />);
    expect(insetOf(panel)).toEqual({ top: '', bottom: '' });
    viewport.move({ height: 400 }, 'resize');
    expect(insetOf(panel)).toEqual({ top: '', bottom: '' });
    rerender(<Panel />);
    expect(insetOf(panel).bottom).toBe('444px');
    unmount();
    expect(insetOf(panel)).toEqual({ top: '', bottom: '' });
  });

  it('keeps the full viewport where the visual viewport API is missing', () => {
    vi.stubGlobal('visualViewport', undefined);
    const { getByTestId } = render(<Panel />);
    expect(insetOf(getByTestId('panel'))).toEqual({ top: '', bottom: '' });
  });
});
