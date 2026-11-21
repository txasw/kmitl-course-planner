import { describe, it, expect } from 'vitest';
import {
  alphaOver,
  contrastRatio,
  shadowFraction,
  shadowToken,
} from '../../../tests/support/contrast';
import { EVENT_PALETTE } from '@/lib/utils/hash-color';
import { CAPTURE_BACKGROUND } from './capture';

// The poster blocks take the soft depth card (ADR-0047 amendment of 2026-11-22), and the export
// rasterizes them over the capture background. The card mixes its tint into the surface token,
// so the image paints the stops the palette suite proves only while the two agree. These pairs
// prove the poster fill as the PNG paints it: each stop of every subject color composited over
// the capture background, with the poster text steps, ink for the name and ink soft for the
// secondary name, the section chip, and the foot, at 4.5:1.
const INK = shadowToken('ink');
const INK_SOFT = shadowToken('ink-soft');

describe('poster capture background', () => {
  it('is the surface the soft card mixes its tint into', () => {
    expect(CAPTURE_BACKGROUND.toLowerCase()).toBe(
      shadowToken('surface').toLowerCase(),
    );
  });

  for (const color of EVENT_PALETTE) {
    for (const stop of ['strong', 'weak'] as const) {
      it(`reads the poster text on the ${stop} stop of ${color} in the image`, () => {
        const fill = alphaOver(
          color,
          shadowFraction(`tint-${stop}`),
          CAPTURE_BACKGROUND,
        );
        expect(contrastRatio(INK, fill)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(INK_SOFT, fill)).toBeGreaterThanOrEqual(4.5);
        // The stripe stays apart from the fill as a UI element.
        expect(contrastRatio(color, fill)).toBeGreaterThanOrEqual(3);
      });
    }
  }
});
