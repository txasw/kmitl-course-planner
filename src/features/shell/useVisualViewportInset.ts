// Keeps the panel inside the part of the screen a phone keyboard leaves. The overlay is a
// fixed layer, and a fixed layer is laid out against the layout viewport, which an on
// screen keyboard does not shrink: Chrome and Firefox for Android shrink only the visual
// viewport. Without this the pane keeps its full height, and the lower fields of a form
// and its pinned submit row sit under the keyboard.
//
// While active the hook follows window.visualViewport and sets the top and bottom inset
// as custom properties on the panel node, where the layers that place themselves with
// VIEWPORT_FIT read them. A browser without the visual viewport API, and any desktop
// browser, whose visual viewport matches the layout one, keeps the full viewport. Leaving
// clears the properties.

import { useLayoutEffect, type RefObject } from 'react';
import {
  NO_INSET,
  VIEWPORT_BOTTOM_PROPERTY,
  VIEWPORT_TOP_PROPERTY,
  sameInset,
  viewportInset,
  type ViewportInset,
} from '@/lib/ui/viewportInset';

function writeInset(node: HTMLElement, inset: ViewportInset): void {
  node.style.setProperty(VIEWPORT_TOP_PROPERTY, `${String(inset.top)}px`);
  node.style.setProperty(VIEWPORT_BOTTOM_PROPERTY, `${String(inset.bottom)}px`);
}

export function useVisualViewportInset(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
): void {
  useLayoutEffect(() => {
    const node = ref.current;
    const viewport = window.visualViewport ?? null;
    if (!active || node === null || viewport === null) {
      return undefined;
    }
    let applied = NO_INSET;
    const update = () => {
      const next = viewportInset(
        document.documentElement.clientHeight,
        viewport,
      );
      if (sameInset(next, applied)) {
        return;
      }
      applied = next;
      writeInset(node, next);
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      node.style.removeProperty(VIEWPORT_TOP_PROPERTY);
      node.style.removeProperty(VIEWPORT_BOTTOM_PROPERTY);
    };
  }, [ref, active]);
}
