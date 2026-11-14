import { describe, it, expect } from 'vitest';
import { DEFAULT_TEMPLATE, templateBySlug } from './exportTemplates';
import {
  EDGE_RESERVE_PX,
  MAX_STAGE_SCALE,
  NARROW_STAGE_PX,
  isNarrowStage,
  TALL_STAGE_TEMPLATE_SLUG,
  isTallStage,
  neighborScale,
  resolveStageTemplate,
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

  it('drops the edge reserve on a narrow stage', () => {
    // 600 px is narrow, so the poster fits 0.94 of the full width rather than 600 - 120.
    expect(selectedScale(share, { width: 600, height: 800 })).toBeCloseTo(
      (600 * 0.94) / 960,
    );
    // At the boundary the reserve applies again.
    expect(
      selectedScale(share, { width: NARROW_STAGE_PX, height: 2000 }),
    ).toBeCloseTo((NARROW_STAGE_PX - 2 * EDGE_RESERVE_PX) / 960);
  });

  it('falls back to a small positive scale on an unmeasured stage', () => {
    expect(selectedScale(share, { width: 0, height: 0 })).toBe(0.1);
    expect(selectedScale(share, { width: 300, height: 0 })).toBe(0.1);
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

describe('isNarrowStage', () => {
  it('is narrow below 900 px of stage width', () => {
    expect(NARROW_STAGE_PX).toBe(900);
    expect(isNarrowStage({ width: 899, height: 600 })).toBe(true);
    expect(isNarrowStage({ width: 900, height: 600 })).toBe(false);
    expect(isNarrowStage({ width: 390, height: 700 })).toBe(true);
  });
});

describe('isTallStage', () => {
  it('is tall only when the stage is taller than wide', () => {
    expect(isTallStage({ width: 360, height: 640 })).toBe(true);
    expect(isTallStage({ width: 1200, height: 600 })).toBe(false);
    expect(isTallStage({ width: 500, height: 500 })).toBe(false);
    // An unmeasured stage is not tall, so the first frame keeps the default.
    expect(isTallStage({ width: 0, height: 0 })).toBe(false);
  });
});

describe('resolveStageTemplate', () => {
  it('opens a tall stage on the portrait phone wallpaper when nothing is chosen', () => {
    expect(resolveStageTemplate(null, true).slug).toBe(
      TALL_STAGE_TEMPLATE_SLUG,
    );
    expect(TALL_STAGE_TEMPLATE_SLUG).toBe('phone-wallpaper-portrait');
  });

  it('opens any other stage on the default template when nothing is chosen', () => {
    expect(resolveStageTemplate(null, false)).toBe(DEFAULT_TEMPLATE);
  });

  it('keeps a chosen template whatever the stage shape', () => {
    expect(resolveStageTemplate('share-16-9', true).slug).toBe('share-16-9');
    expect(resolveStageTemplate('print-a4', false).slug).toBe('print-a4');
  });

  it('falls back to the default for an unknown chosen slug', () => {
    expect(resolveStageTemplate('does-not-exist', true)).toBe(DEFAULT_TEMPLATE);
  });
});
