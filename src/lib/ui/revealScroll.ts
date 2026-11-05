// How far a scroller moves to bring a just opened card into view. The card's header
// is what the student clicked, so it must never leave the top of the view: the
// scroll covers the overflow below the card only up to the point where the header
// reaches the top inset, which is the scroller's scroll-padding-top, so a sticky bar
// at the head of the scroller never covers the header either.

export interface RevealBox {
  cardTop: number;
  cardBottom: number;
  viewTop: number;
  viewBottom: number;
  /** Space reserved at the top of the view, such as a sticky bar's height. */
  topInset: number;
}

/** The scroll delta in pixels: positive scrolls down, zero leaves the view alone. */
export function revealScrollDelta(box: RevealBox): number {
  const top = box.viewTop + box.topInset;
  if (box.cardTop < top) return box.cardTop - top;
  const overflow = box.cardBottom - box.viewBottom;
  if (overflow <= 0) return 0;
  return Math.min(overflow, box.cardTop - top);
}
