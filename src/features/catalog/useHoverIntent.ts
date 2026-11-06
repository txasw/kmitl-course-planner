// Decides when a resting mouse means "show me this", so a hover preview appears for a
// deliberate rest and never for a pointer that only passes over or a list that scrolls
// under a still pointer. It reacts to a mouse only, since touch and pen have no hover. It
// arms once the pointer has moved a few pixels from where it entered, which a list
// scrolling under a still pointer never does, and fires after a short rest, restarting on
// every move. A scroll of the catalog clears it and keeps it quiet for a moment, a press
// clears it because the real drag feedback takes over, and leaving clears it. Escape
// dismisses a showing preview without closing the overlay (WCAG 1.4.13) and keeps it
// dismissed until the pointer enters again.

import { useEffect, useMemo, useRef, type PointerEvent } from 'react';
import { useEscapeDismiss } from '@/components/useEscapeDismiss';

/** How far the pointer must move from its entry point before a rest counts. */
export const HOVER_ARM_PX = 3;
/** How long the pointer must rest before the intent fires. */
export const HOVER_REST_MS = 120;
/** How long after a catalog scroll the intent stays quiet. */
export const SCROLL_QUIET_MS = 150;

const SCROLLER = '[data-catalog-scroller]';

export interface HoverIntentOptions {
  /** Whether the intent may fire; when false a pending rest is dropped. */
  enabled: boolean;
  /** Whether the result of the intent shows now, which arms the Escape dismissal. */
  showing: boolean;
  onIntent: () => void;
  onClear: () => void;
}

export interface HoverIntentHandlers {
  onPointerEnter: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerLeave: () => void;
  /** Capture phase, so it runs before a drag source's own press handler. */
  onPointerDownCapture: (event: PointerEvent<HTMLElement>) => void;
}

interface Point {
  x: number;
  y: number;
}

export function useHoverIntent(
  options: HoverIntentOptions,
): HoverIntentHandlers {
  const optionsRef = useRef(options);
  const origin = useRef<Point | null>(null);
  const armed = useRef(false);
  const dismissed = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScrollAt = useRef(Number.NEGATIVE_INFINITY);
  const detachScroll = useRef<(() => void) | null>(null);

  // Read the latest options from the handlers without rebuilding them every render.
  useEffect(() => {
    optionsRef.current = options;
  });

  const handlers = useMemo(() => {
    const cancel = () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
    const reset = (point: Point | null) => {
      cancel();
      origin.current = point;
      armed.current = false;
    };
    const stopWatchingScroll = () => {
      detachScroll.current?.();
      detachScroll.current = null;
    };
    const handleScroll = () => {
      lastScrollAt.current = Date.now();
      reset(null);
      optionsRef.current.onClear();
    };
    const watchScroll = (element: HTMLElement) => {
      stopWatchingScroll();
      const scroller = element.closest(SCROLLER);
      if (scroller === null) return;
      scroller.addEventListener('scroll', handleScroll, { passive: true });
      detachScroll.current = () => {
        scroller.removeEventListener('scroll', handleScroll);
      };
    };
    const fire = () => {
      timer.current = null;
      if (optionsRef.current.enabled && !dismissed.current) {
        optionsRef.current.onIntent();
      }
    };

    return {
      cancel,
      stopWatchingScroll,
      dismiss: () => {
        reset(origin.current);
        dismissed.current = true;
        optionsRef.current.onClear();
      },
      props: {
        onPointerEnter: (event: PointerEvent<HTMLElement>) => {
          if (event.pointerType !== 'mouse') return;
          dismissed.current = false;
          reset({ x: event.clientX, y: event.clientY });
          watchScroll(event.currentTarget);
        },
        onPointerMove: (event: PointerEvent<HTMLElement>) => {
          // A held button is a press or a drag in progress, never a rest.
          if (event.pointerType !== 'mouse' || event.buttons !== 0) return;
          if (!optionsRef.current.enabled || dismissed.current) return;
          const point = { x: event.clientX, y: event.clientY };
          if (origin.current === null) {
            origin.current = point;
            return;
          }
          if (!armed.current) {
            const moved = Math.hypot(
              point.x - origin.current.x,
              point.y - origin.current.y,
            );
            if (moved < HOVER_ARM_PX) return;
            armed.current = true;
          }
          if (Date.now() - lastScrollAt.current < SCROLL_QUIET_MS) return;
          cancel();
          timer.current = setTimeout(fire, HOVER_REST_MS);
        },
        onPointerLeave: () => {
          reset(null);
          stopWatchingScroll();
          optionsRef.current.onClear();
        },
        onPointerDownCapture: (event: PointerEvent<HTMLElement>) => {
          reset({ x: event.clientX, y: event.clientY });
          optionsRef.current.onClear();
        },
      } satisfies HoverIntentHandlers,
    };
  }, []);

  useEscapeDismiss(options.showing, handlers.dismiss);

  // A disabled intent drops its pending rest, and an unmount detaches everything.
  const { enabled } = options;
  useEffect(() => {
    if (!enabled) handlers.cancel();
  }, [enabled, handlers]);
  useEffect(
    () => () => {
      handlers.cancel();
      handlers.stopWatchingScroll();
    },
    [handlers],
  );

  return handlers.props;
}
