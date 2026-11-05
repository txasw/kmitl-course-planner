// Drives enter and leave transitions for a conditionally rendered element
// without a library. It keeps the element mounted through the leave animation,
// then unmounts it, using a duration matched timeout rather than transitionend,
// which never fires under reduced motion or in a test environment. When motion
// is reduced, open and close are instant. Scroll lock and focus management stay
// keyed on the logical open flag, not on these stages, so they never wait on an
// animation.

import { useEffect, useRef, useState } from 'react';
import { useMediaQuery } from './useMediaQuery';

export type PresenceStage = 'closed' | 'entering' | 'open' | 'leaving';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery(REDUCED_MOTION_QUERY);
}

export function usePresence(
  open: boolean,
  durationMs = 180,
): { mounted: boolean; stage: PresenceStage } {
  const reduced = usePrefersReducedMotion();
  const [stage, setStage] = useState<PresenceStage>(open ? 'open' : 'closed');
  const previousOpen = useRef(open);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Only animate on an actual change, so the first mount does not replay a
    // transition for its initial state.
    if (previousOpen.current === open) return;
    previousOpen.current = open;

    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }

    if (open) {
      if (reduced) {
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

    if (reduced) {
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
  }, [open, reduced, durationMs]);

  return { mounted: stage !== 'closed', stage };
}
