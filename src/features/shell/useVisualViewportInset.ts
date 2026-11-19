// Keeps the panel inside the part of the screen a phone keyboard leaves. The overlay is a
// fixed layer, and a fixed layer is laid out against the layout viewport, which an on
// screen keyboard does not shrink: Chrome and Firefox for Android shrink only the visual
// viewport. Without this the pane keeps its full height, the lower fields of a form and
// its pinned submit row sit under the keyboard, and a field already inside its
// scroller's box is never scrolled, because that box runs under the keyboard too.
//
// While active the hook follows window.visualViewport and sets the top and bottom inset
// as custom properties on the panel node, where the layers that place themselves with
// VIEWPORT_FIT read them: the panel itself, and the sheets and dialogs portalled into it
// by inheritance. When the visible area shrinks, the focused text field inside
// the panel is scrolled into view within its own scroller, since the browser scrolled it
// for the taller panel when it took focus. A browser without the visual viewport API, and
// any desktop browser, whose visual viewport matches the layout one, keeps the full
// viewport. Leaving clears the properties.

import { useLayoutEffect, type RefObject } from 'react';
import {
  NO_INSET,
  VIEWPORT_BOTTOM_PROPERTY,
  VIEWPORT_TOP_PROPERTY,
  sameInset,
  viewportInset,
  type ViewportInset,
} from '@/lib/ui/viewportInset';

function focusedTextField(node: HTMLElement): HTMLElement | null {
  const root = node.getRootNode();
  const focused =
    root instanceof ShadowRoot || root instanceof Document
      ? root.activeElement
      : null;
  if (
    (focused instanceof HTMLInputElement ||
      focused instanceof HTMLTextAreaElement) &&
    node.contains(focused)
  ) {
    return focused;
  }
  return null;
}

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
      const shrank = next.top + next.bottom > applied.top + applied.bottom;
      applied = next;
      writeInset(node, next);
      if (shrank) {
        focusedTextField(node)?.scrollIntoView({ block: 'nearest' });
      }
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
