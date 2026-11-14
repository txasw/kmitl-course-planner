import { describe, it, expect } from 'vitest';
import { templateBySlug } from './exportTemplates';
import {
  EDGE_RESERVE_PX,
  MAX_STAGE_SCALE,
  neighborScale,
  selectedScale,
} from './previewStage';

// Share 16:9 lays out at 960 by 540; the portrait phone wallpaper at 720 by 1560.
const share = templateBySlug('share-16-9');
const portrait = templateBySlug('phone-wallpaper-portrait');

describe('selectedScale', () => {
  it('fits the width left after the edge reserve when width binds', () => {
    // 1200 px wide keeps 1080 after the reserve; 1080 / 960 is under the height bound.
    expect(selectedScale(share, { width: 1200, height: 1000 })).toBeCloseTo(
      (1200 - 2 * EDGE_RESERVE_PX) / 960,
    );
  });

  it('fits the height share when height binds', () => {
    expect(selectedScale(share, { width: 2000, height: 600 })).toBeCloseTo(
      (600 * 0.94) / 540,
    );
  });

  it('scales a poster up on a large stage, past its layout box', () => {
    const scale = selectedScale(share, { width: 1800, height: 900 });
    expect(scale).toBeGreaterThan(1);
    expect(scale).toBeCloseTo((900 * 0.94) / 540);
  });

  it('caps the display scale at two on a very large stage', () => {
    expect(selectedScale(share, { width: 5000, height: 4000 })).toBe(
      MAX_STAGE_SCALE,
    );
    expect(MAX_STAGE_SCALE).toBe(2);
  });

  it('falls back to a small positive scale on an unmeasured stage', () => {
    expect(selectedScale(share, { width: 0, height: 0 })).toBe(0.1);
    // A stage no wider than both reserves has no usable width either.
    expect(selectedScale(share, { width: 100, height: 600 })).toBe(0.1);
  });
});

describe('neighborScale', () => {
  it('sits a neighbor a touch shorter than the selection height', () => {
    expect(neighborScale(portrait, { width: 1000, height: 800 })).toBeCloseTo(
      (800 * 0.94 * 0.9) / 1560,
    );
  });

  it('shares the selection cap', () => {
    expect(neighborScale(share, { width: 5000, height: 4000 })).toBe(
      MAX_STAGE_SCALE,
    );
  });

  it('falls back to a small positive scale with no height', () => {
    expect(neighborScale(share, { width: 900, height: 0 })).toBe(0.1);
  });
});
