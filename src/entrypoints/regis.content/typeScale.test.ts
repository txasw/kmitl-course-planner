import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

// The type scale from ADR-0052, read from the authored shadow stylesheet. The path
// resolves from the project root because the jsdom environment has no file scheme
// import.meta.url.
const css = readFileSync(
  resolve(process.cwd(), 'src/entrypoints/regis.content/style.css'),
  'utf8',
);

const TEXT_SCALE = {
  '2xs': [11, 16],
  xs: [12, 18],
  sm: [14, 22],
  base: [16, 24],
  lg: [18, 28],
} as const;

function ruleBody(selector: string): string {
  const match = new RegExp(`(?:^|\\n)${selector} \\{([^}]*)\\}`).exec(css);
  return match?.[1] ?? '';
}

describe('type scale', () => {
  it('clears the default text namespace and pins every size in px', () => {
    expect(css).toContain('--text-*: initial;');
    for (const [name, [size, leading]] of Object.entries(TEXT_SCALE)) {
      expect(css).toContain(`--text-${name}: ${String(size)}px;`);
      expect(css).toContain(
        `--text-${name}--line-height: ${String(leading)}px;`,
      );
    }
    const declared = [...css.matchAll(/--text-([a-z0-9]+): /g)].map(
      (match) => match[1],
    );
    expect(declared).toEqual(Object.keys(TEXT_SCALE));
  });

  it('declares the 14 px base on the shadow tree root, not the reset host', () => {
    const base = ruleBody('html');
    expect(base).toContain('font-size: 14px;');
    expect(base).toContain('line-height: 22px;');
    expect(base).toContain('-webkit-text-size-adjust: 100%;');
    expect(base).toContain('text-size-adjust: 100%;');
    expect(base).toContain('color: var(--kcp-ink);');
    expect(base).toContain('font-family: var(--font-sans);');
    expect(ruleBody(':host')).not.toMatch(/(^|\s)(font-size|line-height):/);
  });

  it('keeps the relative line heights inside the export poster', () => {
    const poster = ruleBody('\\.kcp-poster');
    expect(poster).toContain('--text-xs--line-height: calc(1 / 0.75);');
    expect(poster).toContain('--text-sm--line-height: calc(1.25 / 0.875);');
    expect(poster).toContain('--text-base--line-height: 1.5;');
    expect(poster).toContain('line-height: 1.5;');
  });
});
