import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { contrastRatio } from '../../../tests/support/contrast';

// Reads the authored token hex values from the shadow stylesheet and asserts that every
// text on background pair the UI actually renders meets its WCAG AA threshold: 4.5 for
// normal text, 3 for a UI component or large text. A token edit that drops a pair below
// its bar fails here, which the browser axe check cannot catch because it does not
// resolve the shadow root token backgrounds.
const css = readFileSync(
  resolve(process.cwd(), 'src/entrypoints/regis.content/style.css'),
  'utf8',
);

function token(name: string): string {
  const match = new RegExp(`--kcp-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  if (match?.[1] === undefined) {
    throw new Error(`token --kcp-${name} not found in the stylesheet`);
  }
  return match[1];
}

const WHITE = '#ffffff';
const AA_NORMAL = 4.5;
const AA_UI = 3;

interface Pair {
  name: string;
  fg: string;
  bg: string;
  min: number;
}

// Each pair names a real usage. The primary brand orange is a UI accent only, on borders,
// focus rings, and the active tab underline, so it carries the 3:1 bar; its text uses
// primary-strong. primary-strong text appears on several soft notice backgrounds, the
// darkest being danger-soft, so it is checked against each.
const PAIRS: Pair[] = [
  {
    name: 'ink on surface',
    fg: token('ink'),
    bg: token('surface'),
    min: AA_NORMAL,
  },
  {
    name: 'ink on surface-alt',
    fg: token('ink'),
    bg: token('surface-alt'),
    min: AA_NORMAL,
  },
  {
    name: 'ink on primary-soft',
    fg: token('ink'),
    bg: token('primary-soft'),
    min: AA_NORMAL,
  },
  {
    name: 'ink-soft on surface',
    fg: token('ink-soft'),
    bg: token('surface'),
    min: AA_NORMAL,
  },
  {
    name: 'ink-soft on surface-alt',
    fg: token('ink-soft'),
    bg: token('surface-alt'),
    min: AA_NORMAL,
  },
  {
    name: 'danger on surface',
    fg: token('danger'),
    bg: token('surface'),
    min: AA_NORMAL,
  },
  {
    name: 'danger on danger-soft',
    fg: token('danger'),
    bg: token('danger-soft'),
    min: AA_NORMAL,
  },
  {
    name: 'warn on surface',
    fg: token('warn'),
    bg: token('surface'),
    min: AA_NORMAL,
  },
  {
    name: 'warn on surface-alt',
    fg: token('warn'),
    bg: token('surface-alt'),
    min: AA_NORMAL,
  },
  {
    name: 'warn on primary-soft',
    fg: token('warn'),
    bg: token('primary-soft'),
    min: AA_NORMAL,
  },
  {
    name: 'success on surface-alt',
    fg: token('success'),
    bg: token('surface-alt'),
    min: AA_NORMAL,
  },
  {
    name: 'success on success-soft',
    fg: token('success'),
    bg: token('success-soft'),
    min: AA_NORMAL,
  },
  {
    name: 'white on primary-strong',
    fg: WHITE,
    bg: token('primary-strong'),
    min: AA_NORMAL,
  },
  {
    name: 'white on primary-hover',
    fg: WHITE,
    bg: token('primary-hover'),
    min: AA_NORMAL,
  },
  {
    name: 'primary-strong on surface',
    fg: token('primary-strong'),
    bg: token('surface'),
    min: AA_NORMAL,
  },
  {
    name: 'primary-strong on surface-alt',
    fg: token('primary-strong'),
    bg: token('surface-alt'),
    min: AA_NORMAL,
  },
  {
    name: 'primary-strong on primary-soft',
    fg: token('primary-strong'),
    bg: token('primary-soft'),
    min: AA_NORMAL,
  },
  {
    name: 'primary-strong on danger-soft',
    fg: token('primary-strong'),
    bg: token('danger-soft'),
    min: AA_NORMAL,
  },
  {
    name: 'primary accent on surface',
    fg: token('primary'),
    bg: token('surface'),
    min: AA_UI,
  },
];

describe('design token contrast', () => {
  for (const pair of PAIRS) {
    it(`${pair.name} meets ${String(pair.min)}:1`, () => {
      expect(contrastRatio(pair.fg, pair.bg)).toBeGreaterThanOrEqual(pair.min);
    });
  }
});
