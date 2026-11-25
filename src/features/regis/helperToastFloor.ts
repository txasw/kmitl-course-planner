// Where the toast region floats on a helper page on a phone. The region rests at the foot
// of the screen, centred, which on a phone is the launcher's own baseline, so a toast such
// as the reason a blocked Add for me gives would cover the launcher and its checklist
// count for as long as it shows. While the helper shows on a phone with the planner
// closed, the region floats instead above the card when it is open, so a toast never
// covers the card's controls, or above the launcher when the card is collapsed or so tall
// that no toast fits above it. The
// distance is measured from the region's own box and the card's or launcher's top, so it
// follows the card's height and the visible part of a wide page as they change.

import { useLayoutEffect, useState, type RefObject } from 'react';
import { useStore } from 'zustand';
import { BREAKPOINTS, minWidthQuery } from '@/lib/ui/breakpoints';
import { LAUNCHER_ID } from '@/features/shell/Launcher';
import { rootOf } from '@/features/shell/useFocusTrap';
import { uiStore } from '@/features/shell/uiStore';
import { useMediaQuery } from '@/features/shell/useMediaQuery';
import { CARD_ID, helperStore } from './helperStore';
import { useCompanionRoute } from './useCompanion';

/** The space between the toast and the top of the card or the launcher. */
export const HELPER_TOAST_GAP = 12;

/** The room a toast needs above the card, its gap included, before it floats there. */
const TOAST_ROOM = 72;

/** The region's bottom offset in pixels on a helper page on a phone, or null elsewhere. */
export function useHelperToastFloor(
  regionRef: RefObject<HTMLElement | null>,
): number | null {
  const route = useCompanionRoute();
  const panelOpen = useStore(uiStore, (state) => state.isOpen);
  const phone = !useMediaQuery(minWidthQuery(BREAKPOINTS.sm));
  const hidden = useStore(helperStore, (state) => state.hidden);
  const collapsed = useStore(helperStore, (state) => state.collapsed);
  const ready = useStore(helperStore, (state) => state.ready);
  const view = useStore(helperStore, (state) => state.view);
  const active = route !== null && !panelOpen && phone && !hidden;
  const [floor, setFloor] = useState<number | null>(null);

  useLayoutEffect(() => {
    const region = regionRef.current;
    const root = region === null ? null : rootOf(region);
    if (!active || region === null || root === null) {
      setFloor(null);
      return undefined;
    }
    const target = () =>
      root.getElementById(CARD_ID) ?? root.getElementById(LAUNCHER_ID);
    // The card, unless it leaves no room above it on the screen, then the launcher.
    const anchor = () => {
      const card = root.getElementById(CARD_ID);
      const launcher = root.getElementById(LAUNCHER_ID);
      const screenTop = window.visualViewport?.offsetTop ?? 0;
      return card !== null &&
        card.getBoundingClientRect().top - screenTop >= TOAST_ROOM
        ? card
        : launcher;
    };
    const measure = () => {
      const over = anchor();
      if (over === null) {
        setFloor(null);
        return;
      }
      // The region's bottom edge plus its current offset is the bottom of the box it
      // resolves against, whatever offset it carries now.
      const applied = Number.parseFloat(getComputedStyle(region).bottom);
      const base =
        region.getBoundingClientRect().bottom +
        (Number.isFinite(applied) ? applied : 0);
      const next = Math.max(
        0,
        Math.round(base - over.getBoundingClientRect().top + HELPER_TOAST_GAP),
      );
      setFloor((current) => (current === next ? current : next));
    };
    measure();
    const over = target();
    const observer =
      typeof ResizeObserver === 'undefined' || over === null
        ? null
        : new ResizeObserver(measure);
    if (over !== null) observer?.observe(over);
    const viewport = window.visualViewport ?? null;
    viewport?.addEventListener('resize', measure);
    viewport?.addEventListener('scroll', measure);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      viewport?.removeEventListener('resize', measure);
      viewport?.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [regionRef, active, collapsed, ready, view]);

  return active ? floor : null;
}
