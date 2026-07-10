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
});
