import { describe, expect, it } from 'vitest';
import {
  NO_INSET,
  bandBehind,
  sameInset,
  viewportInset,
} from './viewportInset';

// The band of a fixed layer that fills a layout viewport of the given height.
function band(height: number) {
  return { top: 0, bottom: height };
}

describe('viewportInset', () => {
  it('reports no inset while the visual viewport fills the layout viewport', () => {
    expect(
      viewportInset(band(844), { offsetTop: 0, height: 844, scale: 1 }),
    ).toBe(NO_INSET);
  });

  it('reports the band an open keyboard covers at the foot', () => {
    expect(
      viewportInset(band(844), { offsetTop: 0, height: 420, scale: 1 }),
    ).toEqual({ top: 0, bottom: 424 });
  });

  it('splits the hidden height when the browser pans the visual viewport down', () => {
    expect(
      viewportInset(band(844), { offsetTop: 120, height: 420, scale: 1 }),
    ).toEqual({ top: 120, bottom: 304 });
  });

  it('ignores a pinch zoom, which pans a magnified page on purpose', () => {
    expect(
      viewportInset(band(844), { offsetTop: 200, height: 422, scale: 2 }),
    ).toBe(NO_INSET);
  });

  it('floors a fractional difference so a desktop zoom never moves a layer', () => {
    expect(
      viewportInset(band(800), { offsetTop: 0, height: 799.4, scale: 1 }),
    ).toBe(NO_INSET);
    expect(
      viewportInset(band(799), { offsetTop: 0, height: 799.6, scale: 1 }),
    ).toBe(NO_INSET);
  });

  it('measures against a band that does not start at the top of the screen', () => {
    expect(
      viewportInset(
        { top: 40, bottom: 900 },
        { offsetTop: 40, height: 420, scale: 1 },
      ),
    ).toEqual({ top: 0, bottom: 440 });
  });

  it('recovers the band behind a layer from the inset it carries', () => {
    expect(
      bandBehind({ top: 100, bottom: 520 }, { top: 100, bottom: 324 }),
    ).toEqual({ top: 0, bottom: 844 });
    expect(bandBehind({ top: 0, bottom: 844 }, NO_INSET)).toEqual({
      top: 0,
      bottom: 844,
    });
  });

  it('compares insets by their sides', () => {
    expect(sameInset({ top: 0, bottom: 4 }, { top: 0, bottom: 4 })).toBe(true);
    expect(sameInset({ top: 0, bottom: 4 }, { top: 1, bottom: 4 })).toBe(false);
    expect(sameInset({ top: 0, bottom: 4 }, NO_INSET)).toBe(false);
  });
});
