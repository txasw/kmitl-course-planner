// Subscribes a component to one CSS media query and re-renders it when the match flips.
// A width query evaluates against the window viewport, not the shadow host. That is the
// overlay width, because the overlay is fixed inset-0, so a breakpoint read here describes
// the panel the user sees. The query list is created once per query string and read through
// useSyncExternalStore, so a change event and a query change both resync without a stale
// first render.

import { useCallback, useMemo, useSyncExternalStore } from 'react';

export function useMediaQuery(query: string): boolean {
  const list = useMemo(() => window.matchMedia(query), [query]);

  const subscribe = useCallback(
    (onChange: () => void) => {
      list.addEventListener('change', onChange);
      return () => {
        list.removeEventListener('change', onChange);
      };
    },
    [list],
  );

  return useSyncExternalStore(subscribe, () => list.matches);
}
