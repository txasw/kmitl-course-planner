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
const FALLBACK_COLOR = '#455A64';

/**
 * Ten curated event block fills, dark enough that white text clears WCAG AA
 * contrast. The order is fixed so the subject to color mapping is stable, and the
 * set avoids the KMITL orange (#E35205) reserved for accents.
 */
export const EVENT_PALETTE: readonly string[] = [
  '#1F5FA8', // blue
  '#0E7C7B', // teal
  '#2E7D32', // green
  '#6A3FA0', // purple
  '#B0355F', // raspberry
  '#3949AB', // indigo
  '#A21CAF', // magenta
  '#8D5A2B', // bronze
  '#5D4037', // brown
  FALLBACK_COLOR, // slate
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

/** The alpha of the subject color tint under the block text (ADR-0035). Shared with the
 * contrast test so the value that ships is the value that is proven AA. */
export const EVENT_TINT_ALPHA = 0.15;

const tintCache = new Map<string, string>();

/** Composite a six digit hex over white at the given alpha, to an opaque six digit hex. */
export function tintOverWhite(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const channel = (start: number): string => {
    const front = parseInt(clean.slice(start, start + 2), 16);
    return Math.round(front * alpha + 255 * (1 - alpha))
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(0)}${channel(2)}${channel(4)}`;
}

/**
 * The subject's block color composited over white at EVENT_TINT_ALPHA, a concrete opaque
 * hex so html-to-image inlines a stable fill and the export matches edit and preview.
 * Memoized per subject since the grid paints one per block.
 */
export function hashTint(subjectId: string): string {
  const cached = tintCache.get(subjectId);
  if (cached !== undefined) {
    return cached;
  }
  const tint = tintOverWhite(hashColor(subjectId), EVENT_TINT_ALPHA);
  tintCache.set(subjectId, tint);
  return tint;
}
