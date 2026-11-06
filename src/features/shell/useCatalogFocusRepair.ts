// Keeps keyboard focus inside the panel when a layout tier change unmounts the catalog
// control that held it. A browser zoom that crosses the dock boundary swaps the header
// toggle for the edge rail or the hide control, or the other way round, and the removed
// control drops focus to the document body, so the next Tab would leave the overlay for
// the host page. A docked column that gives way to the closed sheet turns inert instead,
// and the browser drops the focus it held to the body at its next rendering update, so
// focus inside an inert subtree counts as lost too. The repair runs only when the change
// crosses the dock boundary, the overlay is open, and focus is lost; focus that sits on
// any other live element is never moved.

import { useLayoutEffect, useRef, type RefObject } from 'react';
import { isDockedTier, type LayoutTier } from '@/lib/ui/breakpoints';
import {
  CATALOG_HIDE_ID,
  CATALOG_RAIL_ID,
  CATALOG_TOGGLE_ID,
} from './catalogVisibility';
import { uiStore } from './uiStore';

/** The catalog control that replaces the lost one on the tier just entered. */
function repairTarget(tier: LayoutTier): string {
  if (!isDockedTier(tier)) return CATALOG_TOGGLE_ID;
  return uiStore.getState().catalogVisible ? CATALOG_HIDE_ID : CATALOG_RAIL_ID;
}

/**
 * Whether focus has fallen out of every element, as it does when its holder unmounts, or
 * sits in a subtree the change made inert, which the browser is about to blur.
 */
function focusIsLost(root: Document | ShadowRoot, body: HTMLElement): boolean {
  const active = root.activeElement;
  return (
    active === null || active === body || active.closest('[inert]') !== null
  );
}

export function useCatalogFocusRepair(
  rootRef: RefObject<HTMLElement | null>,
  tier: LayoutTier,
): void {
  const previous = useRef(tier);

  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = tier;
    if (isDockedTier(before) === isDockedTier(tier)) return;
    if (!uiStore.getState().isOpen) return;
    const node = rootRef.current;
    if (node === null) return;
    // In the extension the panel sits in a closed shadow root, whose activeElement is
    // null once focus leaves it, where the document reports its body instead.
    const root = node.getRootNode();
    if (!(root instanceof Document || root instanceof ShadowRoot)) return;
    if (!focusIsLost(root, node.ownerDocument.body)) return;
    root.getElementById(repairTarget(tier))?.focus({ preventScroll: true });
  }, [rootRef, tier]);
}
