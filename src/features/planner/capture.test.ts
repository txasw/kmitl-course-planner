import { describe, it, expect } from 'vitest';
import { shadowToken } from '../../../tests/support/contrast';
import { CAPTURE_BACKGROUND } from './capture';

// The poster blocks take the soft depth card (ADR-0047 amendment of 2026-11-22), and the export
// rasterizes them over the capture background. The card mixes its tint into the surface token,
// so the image paints the stops the palette suite in hash-color.test.ts proves only while the
// two agree, which this pins.

describe('poster capture background', () => {
  it('is the surface the soft card mixes its tint into', () => {
    expect(CAPTURE_BACKGROUND.toLowerCase()).toBe(
      shadowToken('surface').toLowerCase(),
    );
  });
});
