// A pointer swipe along one axis, shared by the toasts (axis x, either direction
// dismisses) and the bottom sheet (axis y, a downward swipe dismisses). The moving
// element tracks the drag and fades as it goes; releasing beyond a threshold reports the
// swipe and its direction, releasing under it springs back. The consumer binds the
// handlers to the element that owns the gesture and the style to the element that moves,
// which may differ: the sheet binds its handle and header only, because capturing the
// pointer on its scrolling body would break both scrolling and taps there. The touch
// class hands the other axis to the browser so a pan across the gesture still scrolls.
// When disabled, for reduced motion, no tracking runs and nothing moves under the
// pointer, so the close control is the only dismissal. The handlers guard on the enabled
// flag internally, so their shape is stable across renders.

import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';

const THRESHOLD_PX = 72;

export type SwipeAxis = 'x' | 'y';

/** The sign of the swipe along its axis: 1 is right or down, -1 is left or up. */
export type SwipeDirection = 1 | -1;

const TOUCH_CLASS: Record<SwipeAxis, string> = {
  x: 'touch-pan-y',
  y: 'touch-pan-x',
};

interface SwipeGestureOptions {
  axis: SwipeAxis;
  onSwipe: (direction: SwipeDirection) => void;
  enabled?: boolean;
}

interface SwipeGesture {
  handlers: {
    onPointerDown: (event: PointerEvent<HTMLElement>) => void;
    onPointerMove: (event: PointerEvent<HTMLElement>) => void;
    onPointerUp: (event: PointerEvent<HTMLElement>) => void;
    onPointerCancel: () => void;
  };
  style: CSSProperties;
  touchClass: string;
}

function along(axis: SwipeAxis, event: PointerEvent<HTMLElement>): number {
  return axis === 'x' ? event.clientX : event.clientY;
}

export function useSwipeGesture({
  axis,
  onSwipe,
  enabled = true,
}: SwipeGestureOptions): SwipeGesture {
  const [offset, setOffset] = useState(0);
  const start = useRef<number | null>(null);

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!enabled || event.button !== 0) {
      return;
    }
    start.current = along(axis, event);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (start.current === null) {
      return;
    }
    setOffset(along(axis, event) - start.current);
  };
  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    if (start.current === null) {
      return;
    }
    const delta = along(axis, event) - start.current;
    start.current = null;
    // Spring back to rest either way; a swipe that dismisses unmounts the element in the
    // same update, so the reset never shows.
    setOffset(0);
    if (Math.abs(delta) > THRESHOLD_PX) {
      onSwipe(delta > 0 ? 1 : -1);
    }
  };
  // A pointer the browser takes over, for a scroll or a system gesture, springs back.
  const onPointerCancel = () => {
    start.current = null;
    setOffset(0);
  };

  const opacity = Math.max(0, 1 - Math.abs(offset) / (THRESHOLD_PX * 2));
  const translate = axis === 'x' ? 'translateX' : 'translateY';
  const style: CSSProperties =
    offset === 0
      ? {}
      : {
          transform: `${translate}(${String(offset)}px)`,
          opacity,
          transition: 'none',
        };

  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
    style,
    touchClass: enabled ? TOUCH_CLASS[axis] : '',
  };
}
