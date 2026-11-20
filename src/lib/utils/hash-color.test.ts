import { describe, it, expect } from 'vitest';
import {
  alphaOver,
  contrastRatio,
  deltaE76,
  shadowFraction,
  shadowToken,
} from '../../../tests/support/contrast';
import {
  EVENT_PALETTE,
  EVENT_TINT_ALPHA,
  hashColor,
  hashTint,
} from './hash-color';

const KMITL_ORANGE = '#e35205';
const WHITE = '#ffffff';
// The shipped text tokens, read from the shadow stylesheet so a token edit is proven
// here against every tint rather than a stale copy of the old value.
const INK = shadowToken('ink');
const INK_SOFT = shadowToken('ink-soft');
const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

// Two block tints must differ by more than a just noticeable difference (about 2.3), so
// neighbouring subjects never read as one color. The closest shipped pair is blue and
// indigo at 2.96.
const MIN_TINT_SEPARATION = 2.5;
// A tint must stand off the grey panel it sits on. Bronze, brown, and slate fell at 7.47
// and below and read as grey; the lowest shipped tint, teal, is 7.76.
const MIN_TINT_OFF_SURFACE = 7.5;

function tints(): string[] {
  return EVENT_PALETTE.map((color) =>
    alphaOver(color, EVENT_TINT_ALPHA, WHITE),
  );
}

describe('EVENT_PALETTE', () => {
  it('holds ten unique six digit hex colors', () => {
    expect(EVENT_PALETTE).toHaveLength(10);
    expect(new Set(EVENT_PALETTE).size).toBe(10);
    for (const color of EVENT_PALETTE) {
      expect(color).toMatch(HEX_PATTERN);
    }
  });

  it('excludes the KMITL orange reserved for accents', () => {
    for (const color of EVENT_PALETTE) {
      expect(color.toLowerCase()).not.toBe(KMITL_ORANGE);
    }
  });

  it('meets WCAG AA contrast against white text for every color', () => {
    for (const color of EVENT_PALETTE) {
      expect(contrastRatio(color, WHITE)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps every pair of colors perceptually distinct', () => {
    let min = Infinity;
    for (let i = 0; i < EVENT_PALETTE.length; i += 1) {
      for (let j = i + 1; j < EVENT_PALETTE.length; j += 1) {
        const a = EVENT_PALETTE[i];
        const b = EVENT_PALETTE[j];
        if (a === undefined || b === undefined) {
          continue;
        }
        min = Math.min(min, deltaE76(a, b));
      }
    }
    expect(min).toBeGreaterThanOrEqual(12);
  });
});

describe('hashColor', () => {
  it('returns the same color for the same subject id', () => {
    expect(hashColor('90592033')).toBe(hashColor('90592033'));
  });

  it('returns a color from the palette', () => {
    for (const subjectId of ['90592033', '01006029', '90642129', '01006001']) {
      expect(EVENT_PALETTE).toContain(hashColor(subjectId));
    }
  });

  it('distributes distinct subjects across more than one color', () => {
    const colors = new Set(
      [
        '90592033',
        '90642033',
        '01006029',
        '90642129',
        '90643016',
        '01006001',
        '90592034',
        '90592035',
      ].map(hashColor),
    );
    expect(colors.size).toBeGreaterThan(1);
  });
});

describe('event block tinted surface', () => {
  it('reads ink on every composited tint at AA', () => {
    for (const color of EVENT_PALETTE) {
      const tint = alphaOver(color, EVENT_TINT_ALPHA, WHITE);
      expect(contrastRatio(INK, tint)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('reads ink soft on every composited tint at AA', () => {
    // The redesigned block sets the subject id, the place, and an English secondary
    // name in ink soft; the section chip and every primary line stay ink.
    for (const color of EVENT_PALETTE) {
      const tint = alphaOver(color, EVENT_TINT_ALPHA, WHITE);
      expect(contrastRatio(INK_SOFT, tint)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps the solid left bar distinct from its tint as a UI element', () => {
    for (const color of EVENT_PALETTE) {
      const tint = alphaOver(color, EVENT_TINT_ALPHA, WHITE);
      expect(contrastRatio(color, tint)).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps every pair of tints apart by more than a noticeable difference', () => {
    const all = tints();
    let min = Infinity;
    for (let i = 0; i < all.length; i += 1) {
      for (let j = i + 1; j < all.length; j += 1) {
        const a = all[i];
        const b = all[j];
        if (a === undefined || b === undefined) {
          continue;
        }
        min = Math.min(min, deltaE76(a, b));
      }
    }
    expect(min).toBeGreaterThanOrEqual(MIN_TINT_SEPARATION);
  });

  it('keeps every tint distinct from the surface-alt panel', () => {
    const surfaceAlt = shadowToken('surface-alt');
    for (const tint of tints()) {
      expect(deltaE76(tint, surfaceAlt), tint).toBeGreaterThanOrEqual(
        MIN_TINT_OFF_SURFACE,
      );
    }
  });

  it('composites the subject color over white at the shared alpha', () => {
    for (const subjectId of ['90592033', '01006029', '90642129']) {
      expect(hashTint(subjectId)).toBe(
        alphaOver(hashColor(subjectId), EVENT_TINT_ALPHA, WHITE),
      );
    }
  });
});

// The soft depth block of the ADR-0047 amendment of 2026-11-20: the soft card of ADR-0071
// tinted by the subject color, a 3 px stripe of the solid color down its left edge, and on a
// flagged block a status dot leading the name and, for danger, a hatch with an inset ring over
// the fill. The fill fades from the strong stop at the top to the weak stop, so every pair is
// proven on both: text at 4.5:1, and the stripe, the dots, and the ring as UI at 3:1.
const SURFACE = shadowToken('surface');
const DANGER = shadowToken('danger');
const WARN = shadowToken('warn');
// The stripe alpha of the .kcp-hatch rule in style.css: the danger color mixed in at 24
// percent over transparent, so a stripe composites over the fill at that alpha.
const HATCH_ALPHA = 0.24;

function softStops(color: string): { stop: string; fill: string }[] {
  return (['strong', 'weak'] as const).map((stop) => ({
    stop,
    fill: alphaOver(color, shadowFraction(`tint-${stop}`), SURFACE),
  }));
}

describe('soft depth event block', () => {
  for (const color of EVENT_PALETTE) {
    for (const { stop, fill } of softStops(color)) {
      it(`reads ink and ink soft on the ${stop} stop of ${color}`, () => {
        expect(contrastRatio(INK, fill)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(INK_SOFT, fill)).toBeGreaterThanOrEqual(4.5);
      });

      it(`keeps the ${color} stripe apart from its ${stop} stop as a UI element`, () => {
        expect(contrastRatio(color, fill)).toBeGreaterThanOrEqual(3);
      });

      it(`shows the status dots and the danger ring on the ${stop} stop of ${color}`, () => {
        expect(contrastRatio(DANGER, fill)).toBeGreaterThanOrEqual(3);
        expect(contrastRatio(WARN, fill)).toBeGreaterThanOrEqual(3);
      });

      it(`reads ink through the hatch on the ${stop} stop of ${color}`, () => {
        // Ink soft falls under 4.5:1 on a hatch stripe, so a hatched block sets its quiet
        // lines, the English name, the chip, and the foot, in ink as well.
        const hatched = alphaOver(DANGER, HATCH_ALPHA, fill);
        expect(contrastRatio(INK, hatched)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});
