import { describe, it, expect } from 'vitest';
import { revealScrollDelta } from './revealScroll';

const VIEW = { viewTop: 100, viewBottom: 500, topInset: 0 };

describe('revealScrollDelta', () => {
  it('leaves a card that is fully visible alone', () => {
    expect(revealScrollDelta({ ...VIEW, cardTop: 150, cardBottom: 400 })).toBe(
      0,
    );
  });

  it('scrolls a bottom overflow into view', () => {
    expect(revealScrollDelta({ ...VIEW, cardTop: 300, cardBottom: 560 })).toBe(
      60,
    );
  });

  it('stops once the header reaches the top of the view', () => {
    // The card is taller than the view, so the full overflow would push its header
    // out of sight; the scroll stops with the header at the top.
    expect(revealScrollDelta({ ...VIEW, cardTop: 300, cardBottom: 900 })).toBe(
      200,
    );
  });

  it('scrolls up to a card whose top sits above the view', () => {
    expect(revealScrollDelta({ ...VIEW, cardTop: 60, cardBottom: 200 })).toBe(
      -40,
    );
  });

  it('keeps the header below a top inset', () => {
    const inset = { ...VIEW, topInset: 48 };
    expect(revealScrollDelta({ ...inset, cardTop: 120, cardBottom: 300 })).toBe(
      -28,
    );
    expect(revealScrollDelta({ ...inset, cardTop: 300, cardBottom: 900 })).toBe(
      152,
    );
  });
});
