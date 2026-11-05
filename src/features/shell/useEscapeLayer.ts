// Routes Escape to one nested layer, such as a popover or a sheet, so it closes that layer
// and never the overlay behind it. The overlay focus trap listens for keydown natively on
// the panel element, which fires before React's root delegated handlers, so a React
// stopPropagation inside the layer comes too late. This hook attaches a native listener
// on the layer element itself, which sits below the panel, so it runs first. It stops
// propagation, so no outer layer sees the press, and prevents the default, so an outer
// focus trap that does receive it reads it as already handled. A press that a deeper
// layer already handled arrives with defaultPrevented set and is left alone, so only the
// innermost layer closes.

import { useEffect, useRef, type RefObject } from 'react';

export function useEscapeLayer(
  layerRef: RefObject<HTMLElement | null>,
  onEscape: () => void,
  active = true,
): void {
  const escapeRef = useRef(onEscape);

  // Keep the latest callback without re-attaching the listener on every render.
  useEffect(() => {
    escapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!active) return undefined;
    const layer = layerRef.current;
    if (layer === null) return undefined;

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.stopPropagation();
      event.preventDefault();
      escapeRef.current();
    };

    layer.addEventListener('keydown', handleKeyDown);
    return () => {
      layer.removeEventListener('keydown', handleKeyDown);
    };
  }, [active, layerRef]);
}
