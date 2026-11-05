import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

// Reads the authored shadow stylesheet and asserts every design token is present
// and mapped into a Tailwind namespace. This guards against a token being
// renamed or dropped, which would silently break every utility built on it. The
// path resolves from the project root because the jsdom test environment does
// not expose a file scheme import.meta.url.
const css = readFileSync(
  resolve(process.cwd(), 'src/entrypoints/regis.content/style.css'),
  'utf8',
);

const COLOR_TOKENS = [
  'primary',
  'primary-strong',
  'primary-hover',
  'primary-soft',
  'ink',
  'ink-soft',
  'surface',
  'surface-alt',
  'border',
  'danger',
  'danger-soft',
  'warn',
  'success',
  'success-soft',
] as const;

const LAYER_TOKENS = {
  grid: 1,
  'grid-active': 2,
  sticky: 10,
  scrim: 20,
  drawer: 30,
  popover: 40,
  sheet: 50,
  dropzone: 60,
  toast: 70,
  dragoverlay: 80,
  tooltip: 90,
  host: 2147483647,
} as const;

const DURATION_TOKENS = { fast: 150, base: 200, slow: 300 } as const;

describe('shadow stylesheet tokens', () => {
  it('declares every kcp token on the shadow host', () => {
    for (const token of COLOR_TOKENS) {
      expect(css).toContain(`--kcp-${token}: #`);
    }
    expect(css).toContain('--kcp-radius:');
    expect(css).toContain('--kcp-shadow:');
  });

  it('maps each kcp token into a tailwind utility namespace', () => {
    for (const token of COLOR_TOKENS) {
      expect(css).toContain(`--color-${token}: var(--kcp-${token})`);
    }
    expect(css).toContain('--radius-kcp: var(--kcp-radius)');
    expect(css).toContain('--shadow-kcp: var(--kcp-shadow)');
  });

  it('declares the layer scale and maps it into the z-index namespace', () => {
    for (const [layer, value] of Object.entries(LAYER_TOKENS)) {
      expect(css).toContain(`--kcp-z-${layer}: ${String(value)};`);
      expect(css).toContain(`--z-index-${layer}: var(--kcp-z-${layer})`);
    }
  });

  it('declares the layer scale in ascending order', () => {
    const declared = [...css.matchAll(/--kcp-z-[a-z-]+: (\d+);/g)].map(
      (match) => Number(match[1]),
    );
    expect(declared).toHaveLength(Object.keys(LAYER_TOKENS).length);
    expect(declared).toEqual([...declared].sort((a, b) => a - b));
  });

  it('declares the motion durations and maps them into the duration namespace', () => {
    for (const [name, ms] of Object.entries(DURATION_TOKENS)) {
      expect(css).toContain(`--kcp-duration-${name}: ${String(ms)}ms;`);
      expect(css).toContain(
        `--transition-duration-${name}: var(--kcp-duration-${name})`,
      );
    }
  });

  it('reads every fixed animation duration from a motion token', () => {
    expect(css).not.toMatch(/animation:[^;]*\b\d+m?s\b/);
    expect(css).toMatch(/animation:[^;]*var\(--kcp-duration-/);
  });
});
