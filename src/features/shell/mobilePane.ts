// The panes of the compact tier of ADR-0048 and the bottom nav items that pick them. The
// nav has one item for the catalog pane and one per plan view, so the plan view the nav
// picks is the same one the medium and wide tabs show, and a window widened past 640 px
// keeps the view the student chose. Every pane change goes through one funnel here, so the
// store writes and the focus hand off hold for every control that switches panes.

import { useStore } from 'zustand';
import { planStore } from '@/features/plans/planStore';
import { commitAndFocus } from './commitAndFocus';
import {
  defaultMobilePane,
  uiStore,
  type MobilePane,
  type PlanView,
} from './uiStore';

/** A bottom nav item: the catalog pane, or the plan pane at one plan view. */
export type NavItem = 'catalog' | PlanView;

/** The nav items in their order on screen. */
export const NAV_ITEMS: readonly NavItem[] = [
  'catalog',
  'timetable',
  'selected',
];

/** The id of a nav item, the focus target of a control that switches to its pane. */
export function navItemId(item: NavItem): string {
  return `kcp-nav-${item}`;
}

/** The nav item that marks the pane on screen. */
export function activeNavItem(pane: MobilePane, planView: PlanView): NavItem {
  return pane === 'catalog' ? 'catalog' : planView;
}

/**
 * The pane the compact tier shows. Before the pane is settled it reads the default the
 * settle will write, so the first frame already shows the right pane.
 */
export function useMobilePane(): MobilePane {
  const pane = useStore(uiStore, (state) => state.mobilePane);
  const hasEntries = useStore(planStore, (state) => state.entries.length > 0);
  return pane ?? defaultMobilePane(hasEntries);
}

/** Show the pane of a nav item, setting the plan view first for a plan item. */
export function selectNavItem(item: NavItem): void {
  const ui = uiStore.getState();
  if (item === 'catalog') {
    ui.setMobilePane('catalog');
    return;
  }
  ui.setPlanView(item);
  ui.setMobilePane('plan');
}

/**
 * Show the pane of a nav item from a control in the pane that turns hidden, and move
 * focus to the item, because the control that asked turns inert with the change.
 */
export function showNavItem(control: Element, item: NavItem): void {
  commitAndFocus(control, navItemId(item), () => {
    selectNavItem(item);
  });
}
