// Clears a transient notice once its window has run, with a pause for WCAG timing (SC
// 2.2.1): while the caller reports the notice as paused, such as while the pointer rests
// on it or focus is inside it, the window stops, and a resume continues from the time
// left rather than from the start. A new notice starts a full window of its own, and a
// notice that leaves forgets its budget, so the same message shown again later is not
// cleared at once. The window is tracked per notice identity, so a caller passes the
// notice value itself, and the latest clear callback is the one that runs.

import { useEffect, useRef } from 'react';

interface Budget {
  notice: unknown;
  remaining: number;
}

export function useAutoClear(
  notice: unknown,
  windowMs: number,
  clear: () => void,
  paused = false,
): void {
  const clearRef = useRef(clear);
  useEffect(() => {
    clearRef.current = clear;
  }, [clear]);

  const budgetRef = useRef<Budget | null>(null);

  useEffect(() => {
    if (notice === null) {
      budgetRef.current = null;
      return undefined;
    }
    const kept = budgetRef.current;
    const budget =
      kept !== null && kept.notice === notice
        ? kept
        : { notice, remaining: windowMs };
    budgetRef.current = budget;
    if (paused) {
      return undefined;
    }
    const started = Date.now();
    const timer = setTimeout(() => {
      clearRef.current();
    }, budget.remaining);
    // The cleanup runs on a pause, a new notice, and unmount, and takes the time spent
    // off this notice's budget, so a resume picks up the rest.
    return () => {
      clearTimeout(timer);
      budget.remaining = Math.max(0, budget.remaining - (Date.now() - started));
    };
  }, [notice, paused, windowMs]);
}
