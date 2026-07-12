// Traditional Thai day colors, applied as a subtle tint on the export template day row
// labels only (ADR-0042, ruling one). The block fill stays subject identity, so the day
// color never competes with it: it is a quiet label accent that appears in the shared
// poster and never in edit mode. Each saturated day color is composited over white so
// the ink label text stays well clear of WCAG AA on the tint, and the result is an
// opaque hex so html-to-image inlines a stable fill when it captures the poster.

import type { DayOfWeek } from '@/lib/domain/types';
import { tintOverWhite } from '@/lib/utils/hash-color';

// The saturated day colors of Thai tradition, one per weekday: Sunday red, Monday yellow,
// Tuesday pink, Wednesday green, Thursday orange, Friday blue, Saturday purple.
const THAI_DAY_HUES: Record<DayOfWeek, string> = {
  0: '#d5322f', // red
  1: '#e8b923', // yellow
  2: '#e7669b', // pink
  3: '#2e9e5b', // green
  4: '#e5852b', // orange
  5: '#2f6fbf', // blue
  6: '#7a3fb0', // purple
};

/** The alpha of the day color tint under the ink label text. Shared with the contrast
 * test so the value that ships is the value proven AA against ink. */
export const DAY_TINT_ALPHA = 0.16;

const cache = new Map<DayOfWeek, string>();

/** The Thai day color composited over white to an opaque hex, a subtle label tint. */
export function dayTint(day: DayOfWeek): string {
  const cached = cache.get(day);
  if (cached !== undefined) {
    return cached;
  }
  const tint = tintOverWhite(THAI_DAY_HUES[day], DAY_TINT_ALPHA);
  cache.set(day, tint);
  return tint;
}
