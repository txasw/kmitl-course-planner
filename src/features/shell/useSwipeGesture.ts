// A pointer swipe along one axis, shared by the toasts (axis x, either direction
// dismisses), the bottom sheet (axis y, a downward swipe dismisses), and the day view
// (axis x, a swipe steps the shown day). The moving element tracks the drag and fades as it
// goes; releasing beyond a threshold reports the swipe and its direction, releasing under it
// springs back. The consumer binds the handlers to the element that owns the gesture and the
// style to the element that moves, which may differ: the sheet binds its handle and header
// only, because capturing the pointer on its scrolling body would break both scrolling and
// taps there. The touch class hands the other axis to the browser so a pan across the
// gesture still scrolls. When disabled, for reduced motion, no tracking runs and nothing
// moves under the pointer, so the close control is the only dismissal. The handlers guard
// on the enabled flag internally, so their shape is stable across renders.
//
// A surface whose children take their own taps and presses, such as the day view over its
// blocks, sets a slop: the gesture then starts only once the pointer has travelled past it
// along the axis, further than across it, and only then captures the pointer, so a tap or a
// long press underneath keeps its own target. A canStart guard can refuse the start, for a
// drag that already owns the pointer.
//
// The touch class leaves the gesture axis to the page, but a browser may still read a
// sideways finger as its own overscroll and navigate back. A consumer that swipes over page
// content passes bindClaim as the ref of the gesture element: it cancels each touch move
// that runs along the axis more than across it, from the first move on, because a browser
// that has begun its own gesture no longer lets a later move be cancelled. Moves across the
// axis are left alone, so the column still scrolls.

import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react';

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
  /** Distance the pointer travels along the axis before the gesture starts. With the
   * default 0 the gesture starts, and captures the pointer, on the press itself. */
  slop?: number;
  /** Asked as the gesture starts; returning false leaves the pointer alone. */
  canStart?: () => boolean;
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
  /** A callback ref that claims the axis from the browser for touch moves. */
  bindClaim: (node: HTMLElement | null) => (() => void) | undefined;
}

interface Origin {
  along: number;
  across: number;
  started: boolean;
}

function along(axis: SwipeAxis, event: PointerEvent<HTMLElement>): number {
  return axis === 'x' ? event.clientX : event.clientY;
}

function across(axis: SwipeAxis, event: PointerEvent<HTMLElement>): number {
  return axis === 'x' ? event.clientY : event.clientX;
}

export function useSwipeGesture({
  axis,
  onSwipe,
  enabled = true,
  slop = 0,
  canStart,
}: SwipeGestureOptions): SwipeGesture {
  const [offset, setOffset] = useState(0);
  const origin = useRef<Origin | null>(null);
  const bindClaim = useCallback(
    (node: HTMLElement | null) => {
      if (node === null || !enabled) {
        return undefined;
      }
      let from: { x: number; y: number } | null = null;
      const onTouchStart = (event: TouchEvent) => {
        const touch = event.touches[0];
        from =
          event.touches.length === 1 && touch !== undefined
            ? { x: touch.clientX, y: touch.clientY }
            : null;
      };
      const onTouchMove = (event: TouchEvent) => {
        const touch = event.touches[0];
        if (from === null || touch === undefined || !event.cancelable) {
          return;
        }
        const dx = touch.clientX - from.x;
        const dy = touch.clientY - from.y;
        const alongAxis = Math.abs(axis === 'x' ? dx : dy);
        const acrossAxis = Math.abs(axis === 'x' ? dy : dx);
        if (alongAxis > acrossAxis && (canStart?.() ?? true)) {
          event.preventDefault();
        }
      };
      node.addEventListener('touchstart', onTouchStart, { passive: true });
      node.addEventListener('touchmove', onTouchMove, { passive: false });
      return () => {
        node.removeEventListener('touchstart', onTouchStart);
        node.removeEventListener('touchmove', onTouchMove);
      };
    },
    [axis, enabled, canStart],
  );

  // Start tracking and take the pointer, unless the guard refuses, which drops the press.
  const start = (event: PointerEvent<HTMLElement>, at: Origin): boolean => {
    if (canStart !== undefined && !canStart()) {
      origin.current = null;
      return false;
    }
    at.started = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    return true;
  };

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!enabled || event.button !== 0) {
      return;
    }
    const at: Origin = {
      along: along(axis, event),
      across: across(axis, event),
      started: false,
    };
    origin.current = at;
    if (slop === 0) {
      start(event, at);
    }
  };
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const at = origin.current;
    if (at === null) {
      return;
    }
    const delta = along(axis, event) - at.along;
    if (!at.started) {
      const drift = Math.abs(across(axis, event) - at.across);
      if (drift > slop && drift >= Math.abs(delta)) {
        // The pointer went the other way first, so the gesture belongs to a scroll.
        origin.current = null;
        return;
      }
      if (Math.abs(delta) <= slop || !start(event, at)) {
        return;
      }
    }
    // Track from where the gesture started, so the element never jumps by the slop.
    setOffset(delta - Math.sign(delta) * slop);
  };
  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    const at = origin.current;
    origin.current = null;
    if (!at?.started) {
      return;
    }
    const delta = along(axis, event) - at.along;
    // Spring back to rest either way; a swipe that dismisses unmounts the element in the
    // same update, so the reset never shows.
    setOffset(0);
    if (Math.abs(delta) > THRESHOLD_PX) {
      onSwipe(delta > 0 ? 1 : -1);
    }
  };
  // A pointer the browser takes over, for a scroll or a system gesture, springs back.
  const onPointerCancel = () => {
    origin.current = null;
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
    bindClaim,
  };
}
