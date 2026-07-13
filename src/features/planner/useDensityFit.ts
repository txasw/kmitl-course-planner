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
// reset key. The reset key changes on the inputs that change the box, the geometry and font
// size, plus the eligibility and the fonts ready signal, and on such a change the level resets
// to full and re-converges, recovering fields a larger canvas now has room for.
//
// The box also settles asynchronously: the poster's final size resolves over the next few
// frames as fonts, the gallery scale transform, and the deferred neighbor posters lay out, and
// the block's box can resize then with no prop change, so a single measurement can read a
// transient size and miss the overflow. A ResizeObserver on the measured box resets the fit to
// full whenever the box resizes, so the convergence re-runs against the settled size. Because a
// demotion never resizes this box, the observer fires only on real box changes, not on a drop.

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
  // The observer callback needs the current eligibility without re-subscribing every render.
  const eligibilityRef = useRef(eligibility);
  eligibilityRef.current = eligibility;

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

  // The poster box does not settle in one frame: fonts, the gallery scale transform, and the
  // deferred neighbor posters resolve over the next few frames, and the block's box can change
  // size then with no prop change, so a single measurement can miss the final size. Observe the
  // measured box and, whenever it resizes, reset to the full field set so the convergence above
  // re-runs against the settled size. Resetting to a fresh full level always re-renders, which
  // re-arms the convergence even when the level was already full. Demoting a field never
  // resizes this box, which is flex sized by the grid cell, so the observer does not loop.
  useLayoutEffect(() => {
    if (!fitToBox) {
      return undefined;
    }
    const el = ref.current;
    if (el === null) {
      return undefined;
    }
    const observer = new ResizeObserver(() => {
      settledKey.current = null;
      setLevel(fullLevel(eligibilityRef.current));
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [fitToBox, ref]);

  return fitToBox ? level : fullLevel(eligibility);
}
