// Traditional Thai day colors, applied as a subtle tint on the export template day row
// labels only (ADR-0042, ruling one). The block fill stays subject identity, so the day
// color never competes with it: it is a quiet label accent that appears in the shared
// poster and never in edit mode. Each label is a soft depth tile of ADR-0071 tinted by its
// day color, the treatment the poster blocks share (ADR-0047 amendment of 2026-11-22), and
// the tile mixes the color into the surface at the soft card stops, light enough that the ink
// label stays well clear of WCAG AA on either stop.

import type { DayOfWeek } from '@/lib/domain/types';

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

/** The saturated Thai day color, the tint of the day label's soft tile. */
export function dayHue(day: DayOfWeek): string {
  return THAI_DAY_HUES[day];
}
