import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { CONTROL_BOUNDARY, CONTROL_DISABLED } from '@/lib/ui/control';
import { FOCUS_OUTLINE, FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_SIZE } from '@/lib/ui/target';

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
  'border-strong',
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
  'sticky-corner': 11,
  scrim: 20,
  drawer: 30,
  popover: 40,
  sheet: 50,
  dropzone: 60,
  toast: 70,
  dragoverlay: 80,
  tooltip: 90,
} as const;

const DURATION_TOKENS = { fast: 150, base: 200, slow: 300 } as const;

describe('shadow stylesheet tokens', () => {
  it('declares every kcp token on the shadow host', () => {
    for (const token of COLOR_TOKENS) {
      expect(css).toContain(`--kcp-${token}: #`);
    }
    expect(css).toContain('--kcp-radius:');
    expect(css).toContain('--kcp-radius-inner: 4px;');
    expect(css).toContain('--kcp-shadow:');
  });

  it('maps each kcp token into a tailwind utility namespace', () => {
    for (const token of COLOR_TOKENS) {
      expect(css).toContain(`--color-${token}: var(--kcp-${token})`);
    }
    expect(css).toContain('--radius-kcp: var(--kcp-radius)');
    expect(css).toContain('--radius-kcp-inner: var(--kcp-radius-inner)');
    expect(css).toContain('--shadow-kcp: var(--kcp-shadow)');
  });

  it('declares the sheet radius', () => {
    expect(css).toContain('--kcp-radius-sheet: 12px;');
    expect(css).toContain('--radius-kcp-sheet: var(--kcp-radius-sheet)');
  });

  it('declares a safe area inset token for every edge', () => {
    for (const edge of ['top', 'right', 'bottom', 'left']) {
      expect(css).toContain(
        `--kcp-safe-${edge}: env(safe-area-inset-${edge}, 0px);`,
      );
    }
  });

  it('declares the target sizes that the shared target classes read', () => {
    expect(css).toContain('--kcp-target-min: 24px;');
    expect(css).toContain('--kcp-target-touch: 44px;');
    expect(TARGET_SIZE).toContain('min-h-(--kcp-target-min)');
    expect(TARGET_SIZE).toContain('min-w-(--kcp-target-min)');
    expect(TARGET_SIZE).toContain('pointer-coarse:min-h-(--kcp-target-touch)');
    expect(TARGET_SIZE).toContain('pointer-coarse:min-w-(--kcp-target-touch)');
  });

  it('animates the sheet entrance from a motion token', () => {
    expect(css).toMatch(
      /\.kcp-sheet-enter \{\s*animation: kcp-sheet-in var\(--kcp-duration-base\) ease-out;/,
    );
  });

  it('draws placeholders in ink soft at full opacity', () => {
    expect(css).toMatch(
      /@layer base \{\s*::placeholder \{\s*color: var\(--kcp-ink-soft\);\s*opacity: 1;\s*\}/,
    );
  });

  it('draws form control boundaries with border-strong, never opacity', () => {
    expect(CONTROL_BOUNDARY).toContain('border-border-strong');
    expect(CONTROL_BOUNDARY).toContain('hover:border-ink-soft');
    expect(CONTROL_DISABLED).toContain('bg-surface-alt');
    expect(`${CONTROL_BOUNDARY} ${CONTROL_DISABLED}`).not.toMatch(/opacity/);
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

  it('keeps the host layer a literal z-index the minifier cannot round', () => {
    expect(css).toMatch(/@utility z-host \{\s*z-index: 2147483647;\s*\}/);
    expect(css).not.toMatch(/--[a-z-]+: 2147483647/);
  });

  it('declares the motion durations and maps them into the duration namespace', () => {
    for (const [name, ms] of Object.entries(DURATION_TOKENS)) {
      expect(css).toContain(`--kcp-duration-${name}: ${String(ms)}ms;`);
      expect(css).toContain(
        `--transition-duration-${name}: var(--kcp-duration-${name})`,
      );
    }
  });

  it('declares the edge easings and the hover intent delay', () => {
    expect(css).toContain('--kcp-ease-enter: cubic-bezier(0.2, 0, 0, 1);');
    expect(css).toContain('--kcp-ease-exit: cubic-bezier(0.4, 0, 1, 1);');
    expect(css).toContain('--kcp-delay-intent: 80ms;');
  });

  it('declares the focus tokens that the shared focus classes read', () => {
    expect(css).toContain('--kcp-focus-color: var(--kcp-primary);');
    expect(css).toContain('--kcp-focus-width: 2px;');
    expect(css).toContain('--kcp-focus-offset: 2px;');
    expect(FOCUS_RING).toContain('ring-(length:--kcp-focus-width)');
    expect(FOCUS_RING).toContain('ring-(color:--kcp-focus-color)');
    expect(FOCUS_OUTLINE).toContain('outline-(length:--kcp-focus-width)');
    expect(FOCUS_OUTLINE).toContain('outline-offset-(--kcp-focus-offset)');
    expect(FOCUS_OUTLINE).toContain('outline-(color:--kcp-focus-color)');
  });

  it('folds the search form on its grid row and drops the motion when reduced', () => {
    expect(css).toContain('--kcp-ease-standard: cubic-bezier(0.2, 0, 0, 1);');
    expect(css).toMatch(
      /\.kcp-fold \{[^}]*grid-template-rows: 1fr;[^}]*transition: grid-template-rows var\(--kcp-duration-base\)\s+var\(--kcp-ease-standard\);/,
    );
    expect(css).toMatch(
      /\.kcp-fold\[data-open='false'\] \{\s*grid-template-rows: 0fr;\s*\}/,
    );
    expect(css).toMatch(
      /\.kcp-fold\[data-open='false'\] > \* \{[^}]*visibility: hidden;[^}]*visibility var\(--kcp-duration-base\);/,
    );
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\s*\.kcp-fold,\s*\.kcp-fold > \*,\s*\.kcp-fold\[data-open='false'\] > \* \{\s*transition: none;/,
    );
  });

  it('reads every fixed animation duration from a motion token', () => {
    expect(css).not.toMatch(/animation:[^;]*\b\d+m?s\b/);
    expect(css).toMatch(/animation:[^;]*var\(--kcp-duration-/);
  });
});
