// Measure a block's content against its box and choose the field set that fits, walking the
// pure density ladder (ADR-0046). A block box has a fixed height from its grid cell, so the
// content may overflow; rather than clip a line mid glyph, this hook starts at the full field
// set and demotes one rung at a time until the content fits, all inside a layout effect so
// the settled field set is committed before the browser paints and before the poster is
// captured. The measured element is the content wrapper only, so the absolute chip and badges
// never contaminate the height.
//
// Convergence and no loop: within one reset key the level is monotonic down, and a demotion
// only hides a field, which never changes the block's box size (the cell size comes from the
// grid tracks, not the content), so a demotion cannot feed back into the measurement or the
// reset key. The reset key changes only on the inputs that do change the box, the geometry
// and font size, plus the eligibility and the fonts ready signal, and on such a change the
// level resets to full and re-converges, recovering fields a larger canvas now has room for.

import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import {
  fullLevel,
  nextDensityLevel,
  sameLevel,
  type DensityEligibility,
  type DensityLevel,
} from '@/lib/planner/blockDensity';
import { useFontsReady } from './fontsReady';

// A sub pixel overflow is rounded away by the integer scroll and client heights, so the
// threshold sits just above zero and biases to the safe side: it would rather drop a field
// that barely fit, which the text export still carries, than keep one clipped by a pixel.
const OVERFLOW_EPS = 0.5;

/** Choose the field set for a block by measuring its content wrapper against its box. When
 * `fitToBox` is off the full set is always returned, so edit mode never measures and its
 * render path stays identical. `fitKey` encodes everything that changes the box pixel size,
 * so a change resets the level to full and re-measures. */
export function useDensityFit(
  ref: RefObject<HTMLElement | null>,
  fitToBox: boolean,
  eligibility: DensityEligibility,
  fitKey: string,
): DensityLevel {
  const fontsReady = useFontsReady();
  const resetKey = `${fitKey}|${eligibility.mask}|${fontsReady ? '1' : '0'}`;
  const [level, setLevel] = useState<DensityLevel>(() =>
    fullLevel(eligibility),
  );
  const settledKey = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!fitToBox) {
      return;
    }
    const el = ref.current;
    if (el === null) {
      return;
    }
    // The inputs that size the box moved: restart from the full field set, then the next
    // pass measures from there.
    if (settledKey.current !== resetKey) {
      settledKey.current = resetKey;
      const full = fullLevel(eligibility);
      if (!sameLevel(level, full)) {
        setLevel(full);
        return;
      }
    }
    // Measure the committed content and demote one rung while it overflows.
    if (el.scrollHeight - el.clientHeight > OVERFLOW_EPS) {
      const next = nextDensityLevel(level);
      if (next !== null) {
        setLevel(next);
      }
    }
  });

  return fitToBox ? level : fullLevel(eligibility);
}
