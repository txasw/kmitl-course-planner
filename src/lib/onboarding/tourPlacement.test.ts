import { describe, expect, it } from 'vitest';
import {
  placeTourCard,
  tourCardWidth,
  TOUR_CARD_MARGIN,
  TOUR_CARD_MAX_WIDTH,
  type Box,
  type TourPlacementInput,
} from './tourPlacement';

const PHONE = { width: 360, height: 740 };
const DESKTOP = { width: 1366, height: 768 };
const CARD = 220;

function input(
  spot: Box,
  panel = PHONE,
  extra: Partial<TourPlacementInput> = {},
): TourPlacementInput {
  return {
    panel,
    spot,
    cardHeight: CARD,
    insetTop: 0,
    insetBottom: 0,
    ...extra,
  };
}

function overlaps(a: Box, b: Box): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

function inside(box: Box, panel: { width: number; height: number }): boolean {
  return (
    box.x >= 0 &&
    box.y >= 0 &&
    box.x + box.width <= panel.width &&
    box.y + box.height <= panel.height
  );
}

describe('tourCardWidth', () => {
  it('fills a phone less the margins', () => {
    expect(tourCardWidth(360)).toBe(360 - 2 * TOUR_CARD_MARGIN);
  });

  it('keeps a reading width on a wide panel', () => {
    expect(tourCardWidth(1366)).toBe(TOUR_CARD_MAX_WIDTH);
  });
});

describe('placeTourCard', () => {
  it('sits along the panel foot when the spotlight is above it', () => {
    const box = placeTourCard(input({ x: 16, y: 60, width: 328, height: 60 }));
    expect(box.y + box.height).toBe(PHONE.height - TOUR_CARD_MARGIN);
    expect(box.x).toBe(TOUR_CARD_MARGIN);
  });

  it('keeps the same place for every spotlight clear of the foot, so Next stays put', () => {
    const first = placeTourCard(
      input({ x: 16, y: 60, width: 200, height: 48 }),
    );
    const second = placeTourCard(
      input({ x: 120, y: 300, width: 120, height: 44 }),
    );
    expect(second).toEqual(first);
  });

  it('moves to the panel head when the spotlight sits along the foot', () => {
    const spot = { x: 0, y: 684, width: 360, height: 56 };
    const box = placeTourCard(input(spot));
    expect(box.y).toBe(TOUR_CARD_MARGIN);
    expect(overlaps(box, spot)).toBe(false);
  });

  it('goes beside a spotlight that reaches both the head and the foot place', () => {
    const spot = { x: 16, y: 200, width: 328, height: 300 };
    const box = placeTourCard(input(spot));
    expect(overlaps(box, spot)).toBe(false);
    expect(inside(box, PHONE)).toBe(true);
  });

  it('goes above such a spotlight when it has more room above', () => {
    const spot = { x: 16, y: 300, width: 328, height: 300 };
    const box = placeTourCard(input(spot));
    expect(box.y + box.height).toBeLessThanOrEqual(spot.y);
    expect(inside(box, PHONE)).toBe(true);
  });

  it('clears the device safe areas at the head and the foot', () => {
    const atFoot = placeTourCard(
      input({ x: 16, y: 60, width: 100, height: 40 }, PHONE, {
        insetBottom: 34,
      }),
    );
    expect(atFoot.y + atFoot.height).toBe(PHONE.height - 34 - TOUR_CARD_MARGIN);
    const atHead = placeTourCard(
      input({ x: 0, y: 680, width: 360, height: 60 }, PHONE, { insetTop: 47 }),
    );
    expect(atHead.y).toBe(47 + TOUR_CARD_MARGIN);
  });

  it('centres the card on a wide panel and keeps it off a spotlight below it', () => {
    const spot = { x: 560, y: 690, width: 240, height: 60 };
    const box = placeTourCard(input(spot, DESKTOP));
    expect(box.width).toBe(TOUR_CARD_MAX_WIDTH);
    expect(box.x).toBe((DESKTOP.width - TOUR_CARD_MAX_WIDTH) / 2);
    expect(overlaps(box, spot)).toBe(false);
  });

  it('stays at the foot on a wide panel when the spotlight is off to the side', () => {
    const spot = { x: 1200, y: 700, width: 120, height: 44 };
    const box = placeTourCard(input(spot, DESKTOP));
    expect(box.y + box.height).toBe(DESKTOP.height - TOUR_CARD_MARGIN);
  });
});
