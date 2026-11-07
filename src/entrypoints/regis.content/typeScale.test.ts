import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
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

  it('keeps only the regular and semibold weights', () => {
    expect(css).toContain('--font-weight-*: initial;');
    const weights = [...css.matchAll(/--font-weight-([a-z]+): (\d+);/g)].map(
      (match) => [match[1], Number(match[2])],
    );
    expect(weights).toEqual([
      ['normal', 400],
      ['semibold', 600],
    ]);
  });

  it('declares the 14 px base on the React root, not the reset host', () => {
    const base = ruleBody('#kcp-app');
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

// Only regular and semibold exist in the theme, so any other weight utility would
// compile to nothing and leave the text at the inherited weight, which reads as a
// styling bug rather than a choice. Uppercase is banned because the transform has
// no effect on Thai and only spaces out the Latin half of a mixed label. Test files
// are skipped because they name these classes to assert on them.
const BANNED_CLASSES = [
  /\bfont-(?:thin|extralight|light|medium|bold|extrabold|black)\b/,
  /\bfont-\[\d/,
  /\buppercase\b/,
];

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return collectSourceFiles(full);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

describe('type guard', () => {
  it('uses no weight beyond regular and semibold and no uppercase in source', () => {
    const root = process.cwd();
    const files = collectSourceFiles(resolve(root, 'src'));
    expect(files.length).toBeGreaterThan(0);
    const hits = files.flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, index) =>
          BANNED_CLASSES.some((pattern) => pattern.test(line))
            ? [`${relative(root, file)}:${String(index + 1)}: ${line.trim()}`]
            : [],
        ),
    );
    expect(hits).toEqual([]);
  });
});
