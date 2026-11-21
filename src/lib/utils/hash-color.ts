// Stable event block colors. Each subject id maps to one entry of a curated
// palette through a deterministic hash, so a subject keeps the same block color
// across renders and sessions. Every color meets WCAG AA contrast against white
// block text, and the set excludes the KMITL orange, which the design reserves
// for interactive accents rather than event fills.

/**
 * A fallback color, also the last palette entry, used when the compiler cannot
 * prove the hashed index is in range. The modulo keeps the index inside the
 * palette in practice, so this is never returned.
 */
const FALLBACK_COLOR = '#A50060';

/**
 * Ten curated event block fills, dark enough that white text clears WCAG AA
 * contrast. The order is fixed so the subject to color mapping is stable, and the
 * set avoids the KMITL orange (#E35205) reserved for accents. Every hue keeps enough
 * chroma that its pale block tint still reads as a color rather than as the grey panel
 * behind it, which is why the set has no brown, bronze, or slate.
 */
export const EVENT_PALETTE: readonly string[] = [
  '#1F5FA8', // blue
  '#0E7C7B', // teal
  '#2E7D32', // green
  '#6A3FA0', // purple
  '#B0355F', // raspberry
  '#3949AB', // indigo
  '#A21CAF', // magenta
  '#00729F', // deep cyan
  '#736B00', // olive
  FALLBACK_COLOR, // berry
];

const FNV_OFFSET_BASIS = 2166136261;
const FNV_PRIME = 16777619;

/**
 * FNV-1a hash of a string, folded to an unsigned 32 bit integer. Deterministic
 * and well distributed across the palette for the eight digit subject codes the
 * API returns.
 */
function hash(value: string): number {
  let result = FNV_OFFSET_BASIS;
  for (const char of value) {
    result ^= char.charCodeAt(0);
    result = Math.imul(result, FNV_PRIME);
  }
  return result >>> 0;
}

/** The stable event block fill for a subject id, the saturated subject color used on the
 * block's left bar. */
export function hashColor(subjectId: string): string {
  const index = hash(subjectId) % EVENT_PALETTE.length;
  return EVENT_PALETTE[index] ?? FALLBACK_COLOR;
}

/** The alpha of the flat subject tint of ADR-0035, which the landing page block mockups
 * still draw. Every grid in the product now takes the soft depth card (ADR-0047 amendment
 * of 2026-11-22). Shared with the contrast test so the value drawn is the value proven AA. */
export const EVENT_TINT_ALPHA = 0.15;
