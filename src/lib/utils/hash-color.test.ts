import { describe, it, expect } from 'vitest';
import { EVENT_PALETTE, hashColor } from './hash-color';

type Rgb = [number, number, number];

const KMITL_ORANGE = '#e35205';
const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

function hexToRgb(hex: string): Rgb {
  const value = hex.replace('#', '');
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

/** Linearize an sRGB channel per the WCAG relative luminance definition. */
function linear(channel: number): number {
  const s = channel / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance([r, g, b]: Rgb): number {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** Contrast ratio of a color against white text, per WCAG 2.1. */
function contrastVsWhite(hex: string): number {
  return 1.05 / (relativeLuminance(hexToRgb(hex)) + 0.05);
}

function labFold(t: number): number {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}

/** Convert a hex color to CIELAB under the D65 reference white. */
function toLab(hex: string): Rgb {
  const [r, g, b] = hexToRgb(hex);
  const rl = linear(r);
  const gl = linear(g);
  const bl = linear(b);
  const x = (rl * 0.4124 + gl * 0.3576 + bl * 0.1805) / 0.95047;
  const y = rl * 0.2126 + gl * 0.7152 + bl * 0.0722;
  const z = (rl * 0.0193 + gl * 0.1192 + bl * 0.9505) / 1.08883;
  const fx = labFold(x);
  const fy = labFold(y);
  const fz = labFold(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIE76 perceptual distance between two colors. */
function deltaE76(a: string, b: string): number {
  const [l1, a1, b1] = toLab(a);
  const [l2, a2, b2] = toLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
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
      expect(contrastVsWhite(color)).toBeGreaterThanOrEqual(4.5);
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
