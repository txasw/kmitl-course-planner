// Dismisses a transient surface on Escape without closing the overlay behind it, which
// WCAG 1.4.13 asks of content that shows on hover or focus. A capture phase document
// listener sees the key wherever focus sits, even when the surface holds no focus, as a
// tooltip or a hover preview never does, and it stops propagation so the overlay focus
// trap never receives the press. The listener attaches only while the surface shows, so
// an idle surface leaves Escape to the layers that own it.

import { useEffect, useRef } from 'react';

export function useEscapeDismiss(active: boolean, onDismiss: () => void): void {
  const dismissRef = useRef(onDismiss);

  // Keep the latest callback without re-attaching the listener on every render.
  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!active) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        dismissRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [active]);
}
