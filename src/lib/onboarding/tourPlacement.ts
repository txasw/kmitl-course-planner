// Where the product tour card sits (ADR-0074), as pure geometry in the panel's CSS pixels.
// The card keeps one place across the steps, so Next stays under the thumb or the pointer
// while the spotlight moves: along the panel's foot, which on a phone is the thumb zone.
// Only when that place would cover the spotlight does it move, to the panel's head. When
// the spotlight is tall enough to reach both, the card goes beside it, below or above, on
// whichever side has more room, so the card never covers its own target. A card wider
// than a phone keeps a reading width and centres on the panel.

export interface Size {
  width: number;
  height: number;
}

export interface Box extends Size {
  x: number;
  y: number;
}

/** Room the card leaves to the panel edge and to the spotlight, in CSS pixels. */
export const TOUR_CARD_MARGIN = 16;

/** The widest the card grows, so its sentence keeps a comfortable line length. */
export const TOUR_CARD_MAX_WIDTH = 380;

export interface TourPlacementInput {
  panel: Size;
  /** The spotlight around the target, in panel coordinates. */
  spot: Box;
  /** The card's measured height; its width follows from the panel. */
  cardHeight: number;
  /** The device safe area at the panel's head and foot, so the card clears a notch or
   * a home indicator. */
  insetTop: number;
  insetBottom: number;
}

/** The card width for a panel: the full width less the margins, up to the reading cap. */
export function tourCardWidth(panelWidth: number): number {
  return Math.max(
    0,
    Math.min(TOUR_CARD_MAX_WIDTH, panelWidth - 2 * TOUR_CARD_MARGIN),
  );
}

function overlaps(a: Box, b: Box): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

function inflate(box: Box, by: number): Box {
  return {
    x: box.x - by,
    y: box.y - by,
    width: box.width + 2 * by,
    height: box.height + 2 * by,
  };
}

/** The card's box in panel coordinates. */
export function placeTourCard(input: TourPlacementInput): Box {
  const { panel, spot, cardHeight, insetTop, insetBottom } = input;
  const width = tourCardWidth(panel.width);
  const x = Math.round((panel.width - width) / 2);
  const top = insetTop + TOUR_CARD_MARGIN;
  const bottom = panel.height - insetBottom - TOUR_CARD_MARGIN - cardHeight;
  const guard = inflate(spot, TOUR_CARD_MARGIN / 2);
  const at = (y: number): Box => ({
    x,
    y: Math.round(y),
    width,
    height: cardHeight,
  });

  const fixed = [bottom, top]
    .map(at)
    .find((box) => box.y >= top && box.y <= bottom && !overlaps(box, guard));
  if (fixed !== undefined) return fixed;

  const roomBelow = panel.height - insetBottom - (guard.y + guard.height);
  const roomAbove = guard.y - insetTop;
  return roomBelow >= roomAbove
    ? at(Math.min(guard.y + guard.height, bottom))
    : at(Math.max(guard.y - cardHeight, top));
}
