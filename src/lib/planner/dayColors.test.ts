import { describe, it, expect } from 'vitest';
import {
  alphaOver,
  contrastRatio,
  shadowFraction,
  shadowToken,
} from '../../../tests/support/contrast';
import { WEEK_DAYS } from '@/lib/parsing/days';
import { dayHue } from './dayColors';

// --kcp-ink, the label text color on the accented template day rows. The tile is the soft
// card tinted by the day color, fading from the strong stop at the top to the weak stop, so
// the ink label must clear WCAG AA for normal text on both, since a poster is read at a glance.
const INK = shadowToken('ink');
const SURFACE = shadowToken('surface');
const AA_NORMAL = 4.5;

describe('Thai day color tiles', () => {
  for (const stop of ['strong', 'weak'] as const) {
    it(`keeps ink label text AA legible on the ${stop} stop of every day tile`, () => {
      for (const day of WEEK_DAYS) {
        const fill = alphaOver(
          dayHue(day),
          shadowFraction(`tint-${stop}`),
          SURFACE,
        );
        expect(contrastRatio(INK, fill)).toBeGreaterThanOrEqual(AA_NORMAL);
      }
    });
  }

  it('gives each weekday a distinct six digit hex color', () => {
    const hues = WEEK_DAYS.map((day) => dayHue(day));
    for (const hue of hues) {
      expect(hue).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(new Set(hues).size).toBe(hues.length);
  });
});
