// Whether a moment has passed, re rendering once when it does. One timer is armed for
// the moment itself rather than a clock that ticks, so a result that is still fresh
// costs nothing until it turns stale.

import { useEffect, useState } from 'react';

export function useIsPast(at: number | null): boolean {
  // The moment the armed timer reached, so a later moment is never read as past.
  const [reached, setReached] = useState<number | null>(null);
  useEffect(() => {
    if (at === null) return;
    const remaining = at - Date.now();
    if (remaining <= 0) return;
    const timer = setTimeout(() => {
      setReached(at);
    }, remaining);
    return () => {
      clearTimeout(timer);
    };
  }, [at]);
  return at !== null && (reached === at || Date.now() >= at);
}
