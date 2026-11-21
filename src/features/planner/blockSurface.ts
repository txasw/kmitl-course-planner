// The two fills a placed block can take (ADR-0047 amendment of 2026-11-20). The soft surface
// is the soft depth card of ADR-0071 tinted by the subject color, with a 3 px accent stripe of
// the solid color down its left edge: the edit grid and the plan suggestion mini grids use it.
// The flat surface is the opaque tint and 4 px bar of ADR-0035, kept for the preview poster and
// its export, whose capture inlines a concrete hex fill and so never depends on color-mix or a
// gradient rendering the same in the raster as on screen. Both carry ink and ink soft text,
// which the palette contrast tests prove on every subject color at either fill.

import type { CSSProperties } from 'react';
import { hashColor, hashTint } from '@/lib/utils/hash-color';

export type BlockSurface = 'soft' | 'flat';

/** A style object that may also set custom properties. */
export type StyleWithVars = CSSProperties & Record<`--${string}`, string>;

/** The fill classes for a surface. The radius is the card radius on both. The soft surface
 * sets the subject stops on itself, so a block keeps its tint inside a quiet neutral card,
 * whose stops would otherwise inherit into it. */
export function surfaceClass(surface: BlockSurface): string {
  return surface === 'soft' ? 'kcp-soft-card kcp-soft-subject' : 'rounded-kcp';
}

/** The fill style for a surface: the soft card reads its tint from a custom property, and the
 * flat fill paints the composited tint as a concrete hex. */
export function surfaceStyle(
  surface: BlockSurface,
  subjectId: string,
): StyleWithVars {
  return surface === 'soft'
    ? { '--kcp-tint': hashColor(subjectId) }
    : { backgroundColor: hashTint(subjectId) };
}

/** The width of the solid accent stripe down the left edge. */
export function stripeClass(surface: BlockSurface): string {
  return surface === 'soft' ? 'w-[3px]' : 'w-1';
}

/** The section chip body: an outline of the tint on the soft card, a quiet ink wash on the
 * flat fill, where the poster keeps its look. The text color is the caller's. */
export function chipClass(surface: BlockSurface): string {
  return surface === 'soft'
    ? 'shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--kcp-tint)_30%,var(--kcp-surface))]'
    : 'bg-ink/10';
}
