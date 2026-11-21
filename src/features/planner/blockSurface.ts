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
