// WCAG 2.1 relative luminance and contrast ratio, shared by the event palette test and
// the design token pair test so both compute the ratio the same way.

/** Parse a six digit hex color into its red, green, and blue channels. */
export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

/** Linearize an sRGB channel (0 to 255) per the WCAG definition. */
export function linearizeChannel(value: number): number {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** The WCAG relative luminance of a hex color. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (
    0.2126 * linearizeChannel(r) +
    0.7152 * linearizeChannel(g) +
    0.0722 * linearizeChannel(b)
  );
}

/** The WCAG contrast ratio between two hex colors, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a) + 0.05;
  const lb = relativeLuminance(b) + 0.05;
  return Math.max(la, lb) / Math.min(la, lb);
}

/** Composite a hex color over a background hex at the given alpha, returning the effective
 * opaque hex. Contrast math has no alpha, so a low alpha tint the runtime paints must be
 * flattened to its effective color before its contrast can be checked. */
export function alphaOver(
  hex: string,
  alpha: number,
  background: string,
): string {
  const [fr, fg, fb] = hexToRgb(hex);
  const [br, bg, bb] = hexToRgb(background);
  const mix = (front: number, back: number): string =>
    Math.round(front * alpha + back * (1 - alpha))
      .toString(16)
      .padStart(2, '0');
  return `#${mix(fr, br)}${mix(fg, bg)}${mix(fb, bb)}`;
}
