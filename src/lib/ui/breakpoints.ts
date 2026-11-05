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

export type LayoutTier = 'compact' | 'medium' | 'lg' | 'xl' | '2xl';

/** The tier a panel of the given CSS pixel width lays out at. */
export function tierForWidth(width: number): LayoutTier {
  if (width >= BREAKPOINTS['2xl']) return '2xl';
  if (width >= BREAKPOINTS.xl) return 'xl';
  if (width >= BREAKPOINTS.lg) return 'lg';
  if (width >= BREAKPOINTS.sm) return 'medium';
  return 'compact';
}

/** Whether the catalog column docks beside the grid rather than opening as a sheet. */
export function isDockedTier(tier: LayoutTier): boolean {
  return tier === 'lg' || tier === 'xl' || tier === '2xl';
}

/** The media query that matches from a breakpoint upward. */
export function minWidthQuery(px: number): string {
  return `(min-width: ${String(px)}px)`;
}
