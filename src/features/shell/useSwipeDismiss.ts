// A pointer swipe to dismiss for a toast. The toast tracks the horizontal drag and fades
// as it moves; releasing beyond a threshold commits the dismissal, releasing under it
// springs back. When disabled, for reduced motion, no tracking runs and nothing moves
// under the pointer, so the close button is the only dismissal. The handlers guard on the
// enabled flag internally, so their shape is stable across renders.

import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';

const THRESHOLD_PX = 72;

interface SwipeDismiss {
  handlers: {
    onPointerDown: (event: PointerEvent<HTMLElement>) => void;
    onPointerMove: (event: PointerEvent<HTMLElement>) => void;
    onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  };
  style: CSSProperties;
}

export function useSwipeDismiss(
  onDismiss: () => void,
  enabled: boolean,
): SwipeDismiss {
  const [dx, setDx] = useState(0);
  const startX = useRef<number | null>(null);

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!enabled || event.button !== 0) {
      return;
    }
    startX.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (startX.current === null) {
      return;
    }
    setDx(event.clientX - startX.current);
  };
  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    if (startX.current === null) {
      return;
    }
    const delta = event.clientX - startX.current;
    startX.current = null;
    if (Math.abs(delta) > THRESHOLD_PX) {
      onDismiss();
    } else {
      // Under the threshold: spring back to rest.
      setDx(0);
    }
  };

  const opacity = Math.max(0, 1 - Math.abs(dx) / (THRESHOLD_PX * 2));
  const style: CSSProperties =
    dx === 0
      ? {}
      : {
          transform: `translateX(${String(dx)}px)`,
          opacity,
          transition: 'none',
          touchAction: 'pan-y',
        };

  return { handlers: { onPointerDown, onPointerMove, onPointerUp }, style };
}
