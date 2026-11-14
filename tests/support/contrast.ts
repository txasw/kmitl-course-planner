// WCAG 2.1 relative luminance and contrast ratio, the CIE76 color difference, and the
// shadow stylesheet token reader, shared by the event palette, day color, and design
// token pair tests so every suite computes and reads colors the same way.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

function labFold(t: number): number {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}

/** Convert a hex color to CIELAB under the D65 reference white. */
function toLab(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex);
  const rl = linearizeChannel(r);
  const gl = linearizeChannel(g);
  const bl = linearizeChannel(b);
  const x = (rl * 0.4124 + gl * 0.3576 + bl * 0.1805) / 0.95047;
  const y = rl * 0.2126 + gl * 0.7152 + bl * 0.0722;
  const z = (rl * 0.0193 + gl * 0.1192 + bl * 0.9505) / 1.08883;
  const fx = labFold(x);
  const fy = labFold(y);
  const fz = labFold(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIE76 perceptual distance between two hex colors. About 2.3 is a just noticeable
 * difference. */
export function deltaE76(a: string, b: string): number {
  const [l1, a1, b1] = toLab(a);
  const [l2, a2, b2] = toLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

let shadowCss: string | undefined;

/** Read an authored `--kcp-` token hex from the shadow stylesheet, so a contrast test
 * checks the value that ships rather than a copy of it. The stylesheet is read on first
 * use, so a suite that only needs the contrast math never touches the file system. */
export function shadowToken(name: string): string {
  shadowCss ??= readFileSync(
    resolve(process.cwd(), 'src/entrypoints/regis.content/style.css'),
    'utf8',
  );
  const match = new RegExp(`--kcp-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(
    shadowCss,
  );
  if (match?.[1] === undefined) {
    throw new Error(`token --kcp-${name} not found in the stylesheet`);
  }
  return match[1];
}
