// Locks scrolling of the host document while the overlay is open. This is the
// single intentional side effect the extension has on the host page. The prior
// inline overflow value is saved and restored, so closing the overlay or
// unmounting leaves the host exactly as it was.

import { useEffect } from 'react';

export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previous;
    };
  }, [active]);
}
