// The first stage of the long press on a drag surface (ADR-0058). A finger held still
// for 120 ms marks the surface pressed, so the student sees the press register before
// the touch sensor starts the drag at 250 ms. A finger that drifts past the touch
// tolerance is a scroll, so the mark clears, and so it does when the finger lifts or the
// browser takes the gesture with a pointer cancel. A mouse never marks a press, since a
// mouse drag starts on movement rather than on time.
//
// The handlers are pointer events, apart from the mouse down and touch start the drag
// sensors listen on, so they spread onto a drag surface beside the drag listeners.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from 'react';
import { PRESS_FEEDBACK_MS, TOUCH_TOLERANCE_PX } from './touchInput';

/** The pressed look: a strong outline over the alternate surface. A block keeps its
 * subject tint, which its inline fill sets, so on a block only the outline shows. */
export const PRESSED_CLASS =
  'bg-surface-alt outline-1 -outline-offset-1 outline-border-strong';

/** The look of a drag source: dimmed to 40 percent while it drags, pressed while a finger
 * holds it before the drag starts. */
export function dragSourceClass(isDragging: boolean, pressed: boolean): string {
  if (isDragging) {
    return 'opacity-40';
  }
  return pressed ? PRESSED_CLASS : '';
}

export interface TouchPressHandlers {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
}

export interface TouchPress {
  /** Whether a finger has held the surface long enough to read as pressed. */
  pressed: boolean;
  handlers: TouchPressHandlers;
}

export function useTouchPress(): TouchPress {
  const [pressed, setPressed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);

  const release = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    origin.current = null;
    setPressed(false);
  }, []);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType !== 'touch' || !event.isPrimary) {
        return;
      }
      release();
      origin.current = { x: event.clientX, y: event.clientY };
      timer.current = setTimeout(() => {
        timer.current = null;
        setPressed(true);
      }, PRESS_FEEDBACK_MS);
    },
    [release],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const start = origin.current;
      if (start === null) {
        return;
      }
      const drift = Math.hypot(
        event.clientX - start.x,
        event.clientY - start.y,
      );
      if (drift > TOUCH_TOLERANCE_PX) {
        release();
      }
    },
    [release],
  );

  // A surface that unmounts mid press, such as a card closing, must not fire its timer.
  useEffect(
    () => () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  const handlers = useMemo(
    () => ({
      onPointerDown,
      onPointerMove,
      onPointerUp: release,
      onPointerCancel: release,
    }),
    [onPointerDown, onPointerMove, release],
  );
  return { pressed, handlers };
}
