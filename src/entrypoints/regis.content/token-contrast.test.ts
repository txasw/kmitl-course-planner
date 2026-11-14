import { describe, it, expect } from 'vitest';
import { contrastRatio, shadowToken } from '../../../tests/support/contrast';

// Reads the authored token hex values from the shadow stylesheet and asserts that every
// text on background pair the UI actually renders meets its WCAG AA threshold: 4.5 for
// normal text, 3 for a UI component or large text. A token edit that drops a pair below
// its bar fails here, which the browser axe check cannot catch because it does not
// resolve the shadow root token backgrounds.

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
// darkest being danger-soft, so it is checked against each. The accent also outlines a
// swap target and a focus ring over a blocked danger-soft footprint, and the switch term
// action on a muted surface-alt section row. border-strong is the form control boundary,
// a UI component on both panel surfaces (ADR-0051). warn-soft fills the pre share notice,
// whose ink text, warn icon, and warn border sit on it. The remove drop zone carries its
// danger border and danger text on both of its fills (ADR-0059).
const PAIRS: Pair[] = [
  {
    name: 'ink on surface',
    fg: shadowToken('ink'),
    bg: shadowToken('surface'),
    min: AA_NORMAL,
  },
  {
    name: 'ink on surface-alt',
    fg: shadowToken('ink'),
    bg: shadowToken('surface-alt'),
    min: AA_NORMAL,
  },
  {
    name: 'ink on primary-soft',
    fg: shadowToken('ink'),
    bg: shadowToken('primary-soft'),
    min: AA_NORMAL,
  },
  {
    name: 'ink-soft on surface',
    fg: shadowToken('ink-soft'),
    bg: shadowToken('surface'),
    min: AA_NORMAL,
  },
  {
    name: 'ink-soft on surface-alt',
    fg: shadowToken('ink-soft'),
    bg: shadowToken('surface-alt'),
    min: AA_NORMAL,
  },
  {
    name: 'danger on surface',
    fg: shadowToken('danger'),
    bg: shadowToken('surface'),
    min: AA_NORMAL,
  },
  {
    name: 'danger on danger-soft',
    fg: shadowToken('danger'),
    bg: shadowToken('danger-soft'),
    min: AA_NORMAL,
  },
  {
    name: 'danger on danger-zone',
    fg: shadowToken('danger'),
    bg: shadowToken('danger-zone'),
    min: AA_NORMAL,
  },
  {
    name: 'danger on danger-zone-over',
    fg: shadowToken('danger'),
    bg: shadowToken('danger-zone-over'),
    min: AA_NORMAL,
  },
  {
    name: 'warn on surface',
    fg: shadowToken('warn'),
    bg: shadowToken('surface'),
    min: AA_NORMAL,
  },
  {
    name: 'warn on surface-alt',
    fg: shadowToken('warn'),
    bg: shadowToken('surface-alt'),
    min: AA_NORMAL,
  },
  {
    name: 'warn on primary-soft',
    fg: shadowToken('warn'),
    bg: shadowToken('primary-soft'),
    min: AA_NORMAL,
  },
  {
    name: 'warn on warn-soft',
    fg: shadowToken('warn'),
    bg: shadowToken('warn-soft'),
    min: AA_NORMAL,
  },
  {
    name: 'ink on warn-soft',
    fg: shadowToken('ink'),
    bg: shadowToken('warn-soft'),
    min: AA_NORMAL,
  },
  {
    name: 'success on surface-alt',
    fg: shadowToken('success'),
    bg: shadowToken('surface-alt'),
    min: AA_NORMAL,
  },
  {
    name: 'success on success-soft',
    fg: shadowToken('success'),
    bg: shadowToken('success-soft'),
    min: AA_NORMAL,
  },
  {
    name: 'white on primary-strong',
    fg: WHITE,
    bg: shadowToken('primary-strong'),
    min: AA_NORMAL,
  },
  {
    name: 'white on primary-hover',
    fg: WHITE,
    bg: shadowToken('primary-hover'),
    min: AA_NORMAL,
  },
  {
    name: 'primary-strong on surface',
    fg: shadowToken('primary-strong'),
    bg: shadowToken('surface'),
    min: AA_NORMAL,
  },
  {
    name: 'primary-strong on surface-alt',
    fg: shadowToken('primary-strong'),
    bg: shadowToken('surface-alt'),
    min: AA_NORMAL,
  },
  {
    name: 'primary-strong on primary-soft',
    fg: shadowToken('primary-strong'),
    bg: shadowToken('primary-soft'),
    min: AA_NORMAL,
  },
  {
    name: 'primary-strong on danger-soft',
    fg: shadowToken('primary-strong'),
    bg: shadowToken('danger-soft'),
    min: AA_NORMAL,
  },
  {
    name: 'primary accent on surface',
    fg: shadowToken('primary'),
    bg: shadowToken('surface'),
    min: AA_UI,
  },
  {
    name: 'primary accent on surface-alt',
    fg: shadowToken('primary'),
    bg: shadowToken('surface-alt'),
    min: AA_UI,
  },
  {
    name: 'primary accent on danger-soft',
    fg: shadowToken('primary'),
    bg: shadowToken('danger-soft'),
    min: AA_UI,
  },
  {
    name: 'white on danger',
    fg: WHITE,
    bg: shadowToken('danger'),
    min: AA_NORMAL,
  },
  {
    name: 'border-strong on surface',
    fg: shadowToken('border-strong'),
    bg: shadowToken('surface'),
    min: AA_UI,
  },
  {
    name: 'border-strong on surface-alt',
    fg: shadowToken('border-strong'),
    bg: shadowToken('surface-alt'),
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
