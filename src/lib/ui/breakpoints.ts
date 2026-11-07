// The panel layout tiers of ADR-0048, cut at the Tailwind default breakpoints so a tier
// read in code and a responsive utility class in markup always agree. The overlay is fixed
// to the viewport, so the viewport width is the panel width these tiers describe.
//
// compact  below 640 px, phones and narrow windows
// medium   640 to 1023 px, the catalog column is a modal left sheet
// lg       1024 to 1279 px, the catalog column docks beside the grid
// xl       1280 to 1535 px, docked and wider
// 2xl      1536 px and up, docked and widest

/** The Tailwind default breakpoints the tiers cut at, as minimum widths in CSS pixels. */
export const BREAKPOINTS = {
  sm: 640,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type DockedTier = 'lg' | 'xl' | '2xl';

export type LayoutTier = 'compact' | 'medium' | DockedTier;

/** The tier a panel of the given CSS pixel width lays out at. */
export function tierForWidth(width: number): LayoutTier {
  if (width >= BREAKPOINTS['2xl']) return '2xl';
  if (width >= BREAKPOINTS.xl) return 'xl';
  if (width >= BREAKPOINTS.lg) return 'lg';
  if (width >= BREAKPOINTS.sm) return 'medium';
  return 'compact';
}

/** Whether the catalog column docks beside the grid rather than opening as a sheet. */
export function isDockedTier(tier: LayoutTier): tier is DockedTier {
  return tier === 'lg' || tier === 'xl' || tier === '2xl';
}

/** The media query that matches from a breakpoint upward. */
export function minWidthQuery(px: number): string {
  return `(min-width: ${String(px)}px)`;
}

/** The width the section comparison opens as a table with a row per section from, the
 * Tailwind md breakpoint. It is not a tier cut: below it the nine comparison columns do
 * not fit, so the comparison opens as a sheet with the table transposed. */
export const COMPARISON_TABLE_MIN_WIDTH = 768;

/** The edit grid font size on a narrow scroller, in CSS pixels. */
export const BASE_GRID_FONT_PX = 11;

// The larger edit grid font sizes, each from the scroller width it starts at, widest first.
// They follow the measured grid scroller rather than the viewport, so hiding the catalog
// column steps the type up. The cuts follow the widths the panel measures at: the medium
// tier and the docked lg and xl scrollers stay below 1024 px, a docked 2xl scroller or a
// full width xl one reaches 1024 px, and a docked scroller on a 1920 px screen reaches
// 1440 px.
const GRID_FONT_STEPS = [
  { minWidth: 1440, fontPx: 13 },
  { minWidth: 1024, fontPx: 12 },
] as const;

/** The edit grid font size for a grid scroller of the given CSS pixel width. */
export function gridFontPx(width: number): number {
  return (
    GRID_FONT_STEPS.find((step) => width >= step.minWidth)?.fontPx ??
    BASE_GRID_FONT_PX
  );
}

/** The media query for a coarse primary pointer such as a finger, the same condition as
 * the Tailwind pointer-coarse variant, so code and markup agree on what reads as touch. */
export const COARSE_POINTER_QUERY = '(pointer: coarse)';
