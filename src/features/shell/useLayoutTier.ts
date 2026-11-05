// Subscribes a component to the panel layout tier of ADR-0048. One media query per tier
// cut reports whether the viewport has reached it; the widest cut reached is handed to
// the pure tierForWidth, so the hook and the unit tested function share one boundary
// table and a tier flips only when a cut is crossed.

import {
  BREAKPOINTS,
  minWidthQuery,
  tierForWidth,
  type LayoutTier,
} from '@/lib/ui/breakpoints';
import { useMediaQuery } from './useMediaQuery';

export function useLayoutTier(): LayoutTier {
  const sm = useMediaQuery(minWidthQuery(BREAKPOINTS.sm));
  const lg = useMediaQuery(minWidthQuery(BREAKPOINTS.lg));
  const xl = useMediaQuery(minWidthQuery(BREAKPOINTS.xl));
  const xxl = useMediaQuery(minWidthQuery(BREAKPOINTS['2xl']));

  if (xxl) return tierForWidth(BREAKPOINTS['2xl']);
  if (xl) return tierForWidth(BREAKPOINTS.xl);
  if (lg) return tierForWidth(BREAKPOINTS.lg);
  if (sm) return tierForWidth(BREAKPOINTS.sm);
  return tierForWidth(0);
}
