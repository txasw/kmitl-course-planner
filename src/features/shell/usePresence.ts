// Drives enter and leave transitions for a conditionally rendered element
// without a library. It keeps the element mounted through the leave animation,
// then unmounts it, using a duration matched timeout rather than transitionend,
// which never fires under reduced motion or in a test environment. When motion
// is reduced, or the caller asks for an instant change, open and close are
// instant. Scroll lock and focus management stay keyed on the logical open flag,
// not on these stages, so they never wait on an animation.

import { useEffect, useRef, useState } from 'react';
import { useMediaQuery } from './useMediaQuery';

export type PresenceStage = 'closed' | 'entering' | 'open' | 'leaving';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery(REDUCED_MOTION_QUERY);
}

export interface PresenceOptions {
  /**
   * Skip the transition for this change, as reduced motion does. A bulk change to many
   * elements at once sets it, so they never animate together.
   */
  instant?: boolean;
}

export function usePresence(
  open: boolean,
  durationMs = 180,
  { instant = false }: PresenceOptions = {},
): { mounted: boolean; stage: PresenceStage } {
  const reduced = usePrefersReducedMotion();
  const skip = reduced || instant;
  const [stage, setStage] = useState<PresenceStage>(open ? 'open' : 'closed');
  const previousOpen = useRef(open);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Only animate on an actual change, so the first mount does not replay a
    // transition for its initial state.
    if (previousOpen.current === open) {
      // Another input changed, and its cleanup cancelled any frame or timer in
      // flight, so a transition stage settles at once rather than staying stranded.
      setStage((current) =>
        current === 'entering' || current === 'leaving'
          ? open
            ? 'open'
            : 'closed'
          : current,
      );
      return;
    }
    previousOpen.current = open;

    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }

    if (open) {
      if (skip) {
        setStage('open');
        return;
      }
      setStage('entering');
      const frame = requestAnimationFrame(() => {
        setStage('open');
      });
      return () => {
        cancelAnimationFrame(frame);
      };
    }

    if (skip) {
      setStage('closed');
      return;
    }
    setStage('leaving');
    timer.current = setTimeout(() => {
      setStage('closed');
      timer.current = null;
    }, durationMs);
    return () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, [open, skip, durationMs]);

  return { mounted: stage !== 'closed', stage };
}
