// Scrolls the catalog so a card the student just opened shows its sections, once the
// open animation has settled and the card has its final height. Only a user expand
// schedules it, so an auto opened result never moves the list. The scroller is found
// by its data attribute rather than passed down, since the card renders inside it at
// every tier, and the top inset is its scroll-padding-top, which a sticky bar at its
// head sets.

import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { revealScrollDelta } from '@/lib/ui/revealScroll';
import { usePrefersReducedMotion } from '@/features/shell/usePresence';

const CATALOG_SCROLLER_ATTR = 'data-catalog-scroller';

/**
 * Scroll the catalog by the least amount that brings the card into view, keeping its
 * header below the scroller's top inset. It moves only the catalog scroller, never an
 * ancestor, so a card in a column that is still sliding in never shifts the panel.
 */
export function revealCard(card: HTMLElement, reduced: boolean): void {
  const scroller = card.closest<HTMLElement>(`[${CATALOG_SCROLLER_ATTR}]`);
  if (scroller === null) return;
  const cardBox = card.getBoundingClientRect();
  const view = scroller.getBoundingClientRect();
  const inset = Number.parseFloat(getComputedStyle(scroller).scrollPaddingTop);
  const delta = revealScrollDelta({
    cardTop: cardBox.top,
    cardBottom: cardBox.bottom,
    viewTop: view.top,
    viewBottom: view.bottom,
    topInset: Number.isFinite(inset) ? inset : 0,
  });
  if (delta === 0) return;
  scroller.scrollBy({ top: delta, behavior: reduced ? 'auto' : 'smooth' });
}

export function useRevealOnExpand(settleMs: number): {
  cardRef: RefObject<HTMLElement | null>;
  /** Call on every toggle: a new toggle cancels a pending reveal, an expand starts one. */
  scheduleReveal: (expanding: boolean) => void;
} {
  const reduced = usePrefersReducedMotion();
  const cardRef = useRef<HTMLElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => cancel, [cancel]);

  const scheduleReveal = useCallback(
    (expanding: boolean) => {
      cancel();
      if (!expanding) return;
      timer.current = setTimeout(
        () => {
          timer.current = null;
          if (cardRef.current !== null) revealCard(cardRef.current, reduced);
        },
        reduced ? 0 : settleMs,
      );
    },
    [cancel, reduced, settleMs],
  );

  return { cardRef, scheduleReveal };
}
