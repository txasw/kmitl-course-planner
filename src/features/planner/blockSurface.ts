// The fill of a placed block (ADR-0047 amendments of 2026-11-20 and 2026-11-22): the soft depth
// card of ADR-0071 tinted by the subject color, with a 3 px accent stripe of the solid color
// down its left edge. Every grid takes it, the edit grid, the plan suggestion mini grids, and
// the preview poster with its export, so a shared image reads as the timetable the owner built.
// The capture inlines each element's computed style, where the gradient, the edge, and the
// shadow have resolved to concrete colors, and exported PNGs of every template were checked
// against the edit grid. Ink and ink soft are proven on both stops of every subject color.

import type { CSSProperties } from 'react';
import { hashColor } from '@/lib/utils/hash-color';

/** A style object that may also set custom properties. */
export type StyleWithVars = CSSProperties & Record<`--${string}`, string>;

/** The fill classes. The block sets the subject stops on itself, so it keeps its tint inside a
 * quiet neutral card, whose stops would otherwise inherit into it. */
export const SURFACE_CLASS = 'kcp-soft-card kcp-soft-subject';

/** The fill style: the soft card reads its tint from a custom property. */
export function surfaceStyle(subjectId: string): StyleWithVars {
  return { '--kcp-tint': hashColor(subjectId) };
}

/** The width of the solid accent stripe down the left edge. */
export const STRIPE_CLASS = 'w-[3px]';

/** The section chip body, an outline of the tint. The text color is the caller's. */
export const CHIP_CLASS =
  'shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--kcp-tint)_30%,var(--kcp-surface))]';

/** The hatch of a danger block: a band across the top of the card, the height of the extra top
 * padding the content takes, so the stripes mark the block without running under its text. */
export const HATCH_BAND = 'h-2';

/** The padding of a block's surface on every side but the bottom. A danger block deepens the top
 * by the band's height, so its first line starts as far below the band as a plain block's starts
 * below its top edge. The bottom padding belongs to the measured content column instead (see
 * contentEndPadding). */
export function blockPadding(dayCard: boolean, danger: boolean): string {
  if (dayCard) {
    return `${danger ? 'pt-4' : 'pt-2'} pr-2.5 pl-3.5`;
  }
  return `${danger ? 'pt-3.5' : 'pt-1.5'} pr-2 pl-2.5`;
}

/** The bottom padding of a block, set on the measured content column rather than the surface
 * (the ADR-0046 amendment on glyph extent). The column clips its overflow, and a line set flush
 * against its bottom edge, as the day card's foot always is, draws its glyphs past its line box:
 * the font's ascent and descent for Thai, with its vowels and tone marks, are taller than the
 * line height. Firefox counts that glyph extent in the column's scroll height, so a tall card read
 * as overflowing however much room it had and the fit dropped its second name, its chips, and its
 * id, and the marks of the bottom line could be cut at the clip edge. Inside the column the padding
 * holds the glyph extent within the clip edge. Both engines count the end padding in the scroll
 * height once content reaches into it, so a line that runs into the padding still reads as an
 * overflow, as it did against the surface padding. The card's outer geometry is unchanged. */
export function contentEndPadding(dayCard: boolean): string {
  return dayCard ? 'pb-2' : 'pb-1.5';
}
