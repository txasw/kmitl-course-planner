import { describe, it, expect } from 'vitest';
import { EVENT_PALETTE } from '@/lib/utils/hash-color';
import {
  alphaOver,
  contrastRatio,
  shadowFraction,
  shadowToken,
} from '../../../tests/support/contrast';

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
  {
    name: 'ink on surface-sunken',
    fg: shadowToken('ink'),
    bg: shadowToken('surface-sunken'),
    min: AA_NORMAL,
  },
  {
    name: 'ink-soft on surface-sunken',
    fg: shadowToken('ink-soft'),
    bg: shadowToken('surface-sunken'),
    min: AA_NORMAL,
  },
  {
    name: 'ink-muted on surface',
    fg: shadowToken('ink-muted'),
    bg: shadowToken('surface'),
    min: AA_NORMAL,
  },
  {
    name: 'ink-muted on surface-alt',
    fg: shadowToken('ink-muted'),
    bg: shadowToken('surface-alt'),
    min: AA_NORMAL,
  },
  {
    name: 'ink-muted on surface-sunken',
    fg: shadowToken('ink-muted'),
    bg: shadowToken('surface-sunken'),
    min: AA_NORMAL,
  },
  {
    name: 'ink-muted on primary-soft',
    fg: shadowToken('ink-muted'),
    bg: shadowToken('primary-soft'),
    min: AA_NORMAL,
  },
  {
    // The figures of the one count badge.
    name: 'surface on ink',
    fg: shadowToken('surface'),
    bg: shadowToken('ink'),
    min: AA_NORMAL,
  },
];

// The soft depth card of ADR-0071 mixes its tint into the surface, from the strong stop
// at the top to the weak stop from 70 percent down. The tint is a subject color from the
// event palette or, on a neutral card, the muted ink. Ink and ink soft may sit anywhere
// on the card, so they are proven on the strong stop, the darkest fill. Ink muted is
// bounded by position, not by role: its glyph tops must sit at or below the weak stop,
// where the fill is flat, so it is proven on the weak stop and the per tint limits below
// show how far above that stop the gradient is still too dark for it.
const SOFT_CARD_TINTS: readonly string[] = [
  shadowToken('ink-muted'),
  ...EVENT_PALETTE,
];

function softCardStop(tint: string, stop: 'strong' | 'weak'): string {
  return alphaOver(
    tint,
    shadowFraction(`tint-${stop}`),
    shadowToken('surface'),
  );
}

const SOFT_CARD_PAIRS: Pair[] = SOFT_CARD_TINTS.flatMap((tint) => [
  {
    name: `ink on the strong stop of a ${tint} soft card`,
    fg: shadowToken('ink'),
    bg: softCardStop(tint, 'strong'),
    min: AA_NORMAL,
  },
  {
    name: `ink-soft on the strong stop of a ${tint} soft card`,
    fg: shadowToken('ink-soft'),
    bg: softCardStop(tint, 'strong'),
    min: AA_NORMAL,
  },
  {
    name: `ink-muted on the weak stop of a ${tint} soft card`,
    fg: shadowToken('ink-muted'),
    bg: softCardStop(tint, 'weak'),
    min: AA_NORMAL,
  },
]);

// The quiet and settled neutral cards of the catalog and the query chip mix the muted
// ink in at lighter stops than the default card. Their strong stop is the darkest fill,
// so every text step proven there may sit anywhere on such a card, with no position bound.
const NEUTRAL_STOP_PAIRS: Pair[] = (['quiet', 'settled'] as const).flatMap(
  (variant) =>
    (['ink', 'ink-soft', 'ink-muted'] as const).map((text) => ({
      name: `${text} on the strong stop of a ${variant} neutral soft card`,
      fg: shadowToken(text),
      bg: alphaOver(
        shadowToken('ink-muted'),
        shadowFraction(`tint-${variant}-strong`),
        shadowToken('surface'),
      ),
      min: AA_NORMAL,
    })),
);

// The position, in percent of the card height from the top, where the gradient reaches
// the weak stop. It matches the 70% stop of the kcp-soft-card utility in style.css and
// the bound that ADR-0071 and docs/CONTRAST.md state for muted text.
const WEAK_STOP_AT = 70;

// The soft card fill at a position from the top. color-mix and the gradient are both
// linear in sRGB, so the fill at a position is the tint mixed in at the linearly
// interpolated percentage between the two stops.
function softCardFillAt(tint: string, position: number): string {
  const strong = shadowFraction('tint-strong');
  const weak = shadowFraction('tint-weak');
  const at = Math.min(position, WEAK_STOP_AT) / WEAK_STOP_AT;
  return alphaOver(tint, strong + (weak - strong) * at, shadowToken('surface'));
}

// The highest whole percent position from which ink muted clears 4.5:1 all the way down
// to the bottom of the card. The fill lightens monotonically toward the weak stop, so
// the first passing position going down is the limit.
function mutedTextLimit(tint: string): number {
  for (let position = 0; position <= WEAK_STOP_AT; position += 1) {
    const ratio = contrastRatio(
      shadowToken('ink-muted'),
      softCardFillAt(tint, position),
    );
    if (ratio >= AA_NORMAL) return position;
  }
  return Number.POSITIVE_INFINITY;
}

describe('soft card muted text bound', () => {
  for (const tint of SOFT_CARD_TINTS) {
    it(`ink-muted clears 4.5:1 at and below the ${String(WEAK_STOP_AT)} percent bound on a ${tint} soft card`, () => {
      expect(mutedTextLimit(tint)).toBeLessThanOrEqual(WEAK_STOP_AT);
    });
  }
});

// The search page coach mark of ADR-0072 sets white copy on its scrim, the ink mixed in
// at the scrim strength. The lightest page the scrim can lie over is white, so the copy
// is checked there; any darker host colour under it only raises the ratio.
const COACH_SCRIM_OVER_WHITE = alphaOver(
  shadowToken('ink'),
  shadowFraction('scrim-coach-strength'),
  WHITE,
);

const COACH_MARK_PAIRS: Pair[] = [
  {
    name: 'white callout and Not again today on the coach mark scrim',
    fg: WHITE,
    bg: COACH_SCRIM_OVER_WHITE,
    min: AA_NORMAL,
  },
];

describe('design token contrast', () => {
  for (const pair of [
    ...PAIRS,
    ...SOFT_CARD_PAIRS,
    ...NEUTRAL_STOP_PAIRS,
    ...COACH_MARK_PAIRS,
  ]) {
    it(`${pair.name} meets ${String(pair.min)}:1`, () => {
      expect(contrastRatio(pair.fg, pair.bg)).toBeGreaterThanOrEqual(pair.min);
    });
  }
});
