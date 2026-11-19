// A visual viewport fake for component tests. jsdom implements neither
// window.visualViewport nor layout, so this stubs the first with the fields and events a
// phone browser offers as its keyboard opens and as it pans, and lays out each fixed layer
// placed with VIEWPORT_FIT: its client rect is the band of a layout viewport of the given
// height, less the inset properties the layer carries inline. The band can grow, as the
// layout viewport of a phone does when the browser hides its toolbar. Callers undo the
// stubs with the returned restore.

import { act } from '@testing-library/react';
import { vi } from 'vitest';
import {
  VIEWPORT_BOTTOM_PROPERTY,
  VIEWPORT_FIT,
  VIEWPORT_TOP_PROPERTY,
} from '@/lib/ui/viewportInset';

// The class that marks a layer placed with VIEWPORT_FIT.
const FIT_MARK = VIEWPORT_FIT.split(' ').at(-1) ?? VIEWPORT_FIT;

export interface FakeVisualViewport {
  offsetTop: number;
  height: number;
  scale: number;
  /** Moves the visual viewport and fires the event a browser fires for it. */
  move: (
    next: { offsetTop?: number; height?: number },
    type: 'resize' | 'scroll',
  ) => void;
  /** Sets the height of the layout viewport the fixed layers resolve against. */
  setLayoutHeight: (height: number) => void;
  restore: () => void;
}

function insetOf(node: HTMLElement, property: string): number {
  const value = Number.parseFloat(node.style.getPropertyValue(property));
  return Number.isNaN(value) ? 0 : value;
}

export function installVisualViewport(
  layoutHeight: number,
): FakeVisualViewport {
  let layout = layoutHeight;
  const target = new EventTarget();
  const fake: FakeVisualViewport = {
    offsetTop: 0,
    height: layoutHeight,
    scale: 1,
    move(next, type) {
      fake.offsetTop = next.offsetTop ?? fake.offsetTop;
      fake.height = next.height ?? fake.height;
      act(() => {
        target.dispatchEvent(new Event(type));
      });
    },
    setLayoutHeight(height) {
      layout = height;
    },
    restore() {
      rect.mockRestore();
    },
  };
  vi.stubGlobal('visualViewport', {
    get offsetTop() {
      return fake.offsetTop;
    },
    get height() {
      return fake.height;
    },
    get scale() {
      return fake.scale;
    },
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
  });
  const rect = vi
    .spyOn(Element.prototype, 'getBoundingClientRect')
    .mockImplementation(function (this: Element) {
      if (
        !(this instanceof HTMLElement) ||
        !this.classList.contains(FIT_MARK)
      ) {
        // Any other node keeps the empty box jsdom reports for it.
        return DOMRect.fromRect();
      }
      const top = insetOf(this, VIEWPORT_TOP_PROPERTY);
      const bottom = layout - insetOf(this, VIEWPORT_BOTTOM_PROPERTY);
      return DOMRect.fromRect({
        x: 0,
        y: top,
        width: 390,
        height: bottom - top,
      });
    });
  return fake;
}
