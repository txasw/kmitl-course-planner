// Keeps keyboard focus inside the panel when a layout tier change unmounts the catalog
// control that held it. Each kind of tier reaches the catalog its own way: the header
// toggle on the medium tier, the hide control or the edge rail on the docked tiers, and
// the bottom nav below 640 px. A browser zoom that crosses from one kind to another swaps
// those controls, and the removed control drops focus to the document body, so the next
// Tab would leave the overlay for the host page. A catalog column that gives way to the
// closed sheet or to a hidden pane turns inert instead, and the browser drops the focus
// it held to the body at its next rendering update, so focus inside an inert subtree
// counts as lost too. The repair runs only when the change crosses from one kind to
// another, the overlay is open, and focus is lost; focus that sits on any other live
// element is never moved.

import { useLayoutEffect, useRef, type RefObject } from 'react';
import { isDockedTier, type LayoutTier } from '@/lib/ui/breakpoints';
import {
  CATALOG_HIDE_ID,
  CATALOG_RAIL_ID,
  CATALOG_TOGGLE_ID,
} from './catalogVisibility';
import { activeNavItem, navItemId } from './mobilePane';
import { uiStore } from './uiStore';
import { focusIsLost } from './useFocusTrap';

type CatalogControlKind = 'nav' | 'sheet' | 'dock';

function controlKind(tier: LayoutTier): CatalogControlKind {
  if (tier === 'compact') return 'nav';
  return isDockedTier(tier) ? 'dock' : 'sheet';
}

/**
 * The catalog control that replaces the lost one on the tier just entered. Below 640 px
 * it is the nav item of the pane on screen; Layout settles the pane before this runs.
 */
function repairTarget(tier: LayoutTier): string {
  const ui = uiStore.getState();
  switch (controlKind(tier)) {
    case 'nav':
      return navItemId(activeNavItem(ui.mobilePane ?? 'catalog', ui.planView));
    case 'sheet':
      return CATALOG_TOGGLE_ID;
    case 'dock':
      return ui.catalogVisible ? CATALOG_HIDE_ID : CATALOG_RAIL_ID;
  }
}

export function useCatalogFocusRepair(
  rootRef: RefObject<HTMLElement | null>,
  tier: LayoutTier,
): void {
  const previous = useRef(tier);

  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = tier;
    if (controlKind(before) === controlKind(tier)) return;
    if (!uiStore.getState().isOpen) return;
    const node = rootRef.current;
    if (node === null) return;
    if (!focusIsLost(node)) return;
    const root = node.getRootNode();
    if (!(root instanceof Document || root instanceof ShadowRoot)) return;
    root.getElementById(repairTarget(tier))?.focus({ preventScroll: true });
  }, [rootRef, tier]);
}
