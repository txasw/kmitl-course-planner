// A pointer swipe for component tests. jsdom dispatches pointer events but does not
// implement pointer capture, so the helper stubs setPointerCapture for the length of the
// gesture and restores the prototype afterwards. The swipe presses at the origin, moves
// by the distance along one axis, and releases there, the sequence useSwipeGesture reads.

import { fireEvent } from '@testing-library/react';

export function swipe(
  element: Element,
  axis: 'x' | 'y',
  distance: number,
): void {
  const proto = Element.prototype;
  const had = Object.prototype.hasOwnProperty.call(proto, 'setPointerCapture');
  if (!had) {
    Object.defineProperty(proto, 'setPointerCapture', {
      configurable: true,
      value: () => undefined,
    });
  }
  const at = (offset: number) =>
    axis === 'x'
      ? { clientX: 100 + offset, clientY: 100 }
      : { clientX: 100, clientY: 100 + offset };
  try {
    fireEvent.pointerDown(element, { button: 0, pointerId: 1, ...at(0) });
    fireEvent.pointerMove(element, { pointerId: 1, ...at(distance) });
    fireEvent.pointerUp(element, { pointerId: 1, ...at(distance) });
  } finally {
    if (!had) {
      Reflect.deleteProperty(proto, 'setPointerCapture');
    }
  }
}
