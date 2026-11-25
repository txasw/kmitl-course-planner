// The floating placement of the helper card's menus, the section menu and the more menu,
// with floating-ui against the viewport. A fixed strategy lets a menu escape the card's
// scrolling body; the preferred side comes first, flip and shift keep it on screen when a
// short screen has no room there, and its height is capped to the room on the side it
// takes, so no part of it clips.

import { useCallback } from 'react';
import {
  autoUpdate,
  flip,
  offset,
  shift,
  size,
  useFloating,
} from '@floating-ui/react';

const GUTTER = 8;

/**
 * The floating placement of a menu in the helper card: preferred side first, flipped and
 * shifted inside the viewport, with its height capped to the room on that side.
 */
export function useHelperFloating(
  open: boolean,
  placement: 'top-start' | 'top-end' | 'bottom-end',
  maxHeight?: number,
) {
  const { refs, floatingStyles } = useFloating({
    open,
    strategy: 'fixed',
    placement,
    middleware: [
      offset(4),
      flip({ padding: GUTTER }),
      shift({ padding: GUTTER }),
      size({
        padding: GUTTER,
        apply({ availableHeight, elements }) {
          elements.floating.style.maxHeight = `${String(
            Math.max(
              0,
              Math.min(maxHeight ?? Number.POSITIVE_INFINITY, availableHeight),
            ),
          )}px`;
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
  });
  // Stable callback refs, so the setters are attached through JSX and never read in render.
  const setReference = useCallback(
    (node: HTMLElement | null) => {
      refs.setReference(node);
    },
    [refs],
  );
  const setFloating = useCallback(
    (node: HTMLElement | null) => {
      refs.setFloating(node);
    },
    [refs],
  );
  return { setReference, setFloating, floatingStyles };
}
