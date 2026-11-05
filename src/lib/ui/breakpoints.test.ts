import { describe, it, expect } from 'vitest';
import {
  BASE_GRID_FONT_PX,
  BREAKPOINTS,
  gridFontPx,
  isDockedTier,
  minWidthQuery,
  tierForWidth,
} from './breakpoints';

describe('tierForWidth', () => {
  it.each([
    [0, 'compact'],
    [390, 'compact'],
    [639, 'compact'],
    [640, 'medium'],
    [768, 'medium'],
    [1023, 'medium'],
    [1024, 'lg'],
    [1279, 'lg'],
    [1280, 'xl'],
    [1535, 'xl'],
    [1536, '2xl'],
    [1920, '2xl'],
  ] as const)('places %i px in the %s tier', (width, tier) => {
    expect(tierForWidth(width)).toBe(tier);
  });

  it('cuts at the Tailwind default breakpoints', () => {
    expect(tierForWidth(BREAKPOINTS.sm)).toBe('medium');
    expect(tierForWidth(BREAKPOINTS.lg)).toBe('lg');
    expect(tierForWidth(BREAKPOINTS.xl)).toBe('xl');
    expect(tierForWidth(BREAKPOINTS['2xl'])).toBe('2xl');
  });
});

describe('isDockedTier', () => {
  it('docks the catalog from the lg tier upward', () => {
    expect(isDockedTier('compact')).toBe(false);
    expect(isDockedTier('medium')).toBe(false);
    expect(isDockedTier('lg')).toBe(true);
    expect(isDockedTier('xl')).toBe(true);
    expect(isDockedTier('2xl')).toBe(true);
  });
});

describe('minWidthQuery', () => {
  it('builds a min width media query in pixels', () => {
    expect(minWidthQuery(1024)).toBe('(min-width: 1024px)');
  });
});

describe('gridFontPx', () => {
  it.each([
    [0, 11],
    [736, 11],
    [1023, 11],
    [1024, 12],
    [1334, 12],
    [1439, 12],
    [1440, 13],
    [1888, 13],
  ] as const)('sets a %i px scroller in %i px type', (width, fontPx) => {
    expect(gridFontPx(width)).toBe(fontPx);
  });

  it('keeps the base size before the first measurement', () => {
    expect(gridFontPx(0)).toBe(BASE_GRID_FONT_PX);
  });
});
