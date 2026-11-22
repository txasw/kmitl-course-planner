// Measure a block's content against its box and choose the field set that fits, walking the
// pure density ladder (ADR-0046). A block box has a fixed height from its grid cell, so the
// content may overflow; rather than clip a line mid glyph, this hook starts at the full field
// set and demotes one rung at a time until the content fits, all inside a layout effect so
// the settled field set is committed before the browser paints and before the poster is
// captured. The measured element is the content wrapper only, so the absolute stripe and hatch
// never contaminate the height. The wrapper carries the block's bottom padding, so the glyph
// extent of its last line, which Firefox counts in the scroll height, stays inside its clip edge
// (contentEndPadding in blockSurface). When the ladder reaches the name, the hook also reads
// how many lines the name renders and how many lines of content stand past the box, so the
// name clamps to the lines that fit in one step rather than one line per pass.
//
// The fit reads width as well as height (the ADR-0046 amendment of 2026-11-20). The subject id
// and the time never wrap, so each marked whole field is measured against its own line: one
// wider than the line drops at once, whole, before the height walk runs. Any other horizontal
// overflow of the content wrapper walks the ladder like a height overflow, so no field is ever
// cut at the right edge of a narrow block. The secondary name is a whole field too: it wraps
// only between its words, so one wider than its line drops it whole. The name wraps only between
// its words, so a word wider than the name's line is read from the name itself and steps the
// name form down before the height walk runs: a smaller type step, then for a name in Latin
// script each abbreviated form in turn, least shortened first, then the break form that lets the
// word still too wide break inside. The name never gives way to the subject id (the ADR-0047
// amendment of 2026-11-22).
//
// Once the content fits, a reclaim pass offers back, once each, the time, the secondary name,
// and the subject id the walk dropped on the way down, since a later rung such as the secondary
// name or the name clamp may have freed the room an earlier drop needed. Without it a name
// language of both cost a block its id even where the second name never fit (the ADR-0046
// amendment of 2026-11-20). A reclaimed field that overflows is the top rung the walk drops
// first, so the level returns to where it was and the field stays tried until the next reset.
// The pass offers nothing once the walk dropped the section chip or the place, so a returned
// field never shows above a hidden one the ladder ranks higher and the time never outlives the
// place.
//
// Convergence and no loop: within one reset key the walk only demotes, and the reclaim pass
// promotes at most once per field, three fields in all, so the level settles after a bounded
// number of passes. A demotion or a reclaim only shows or hides a field, which never changes
// the block's box size (the cell size comes from the grid tracks, not the content), so neither
// can feed back into the measurement or the reset key. The reset key changes on the inputs
// that change the box, the geometry and font size, plus the eligibility and the fonts ready
// signal, and on such a change the level resets to full, the tried fields clear, and the fit
// re-converges, recovering fields a larger canvas now has room for.
//
// The box also settles asynchronously: the poster's final size resolves over the next few
// frames as fonts and the gallery scale transform lay out, and the block's box can resize
// then with no prop change, so a single measurement can read a transient size and miss the
// overflow. A ResizeObserver on the measured box resets the fit to
// full whenever the box resizes, so the convergence re-runs against the settled size. Because a
// demotion never resizes this box, the observer fires only on real box changes, not on a drop.
//
// The edit grid fits too (ADR-0050), and there the fit pauses for the length of a drag: a
// paused block keeps the field set it settled on and never reads layout, so the drag frame
// budget holds. A box resize during the pause only marks the fit stale, and the first
// render after the drag resets to full and re-converges.

import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import {
  dropWholeFields,
  fullLevel,
  nextDensityLevel,
  nextNameForm,
  nextReclaim,
  sameLevel,
  type DensityEligibility,
  type DensityLadder,
  type DensityLevel,
  type NameFit,
  type ReclaimField,
  type WholeField,
} from '@/lib/planner/blockDensity';
import { useFontsReady } from './fontsReady';

// A sub pixel overflow is rounded away by the integer scroll and client heights, so the
// threshold sits just above zero and biases to the safe side: it would rather drop a field
// that barely fit, which the text export still carries, than keep one clipped by a pixel.
const OVERFLOW_EPS = 0.5;

/** The marker on the name element inside a measured content wrapper. */
const FIT_NAME_ATTR = 'data-fit-name';

/** The marker on a whole field, its value naming the field. */
export const FIT_WHOLE_ATTR = 'data-fit-whole';

function isWholeField(value: string | undefined): value is WholeField {
  return value === 'id' || value === 'time' || value === 'secondary';
}

/** The whole fields wider than their own line. A whole field clips its own overflow, so its
 * scroll width past its client width is the text it could not show; both are layout sizes,
 * which a scale transform on the poster stage never changes. */
function measureWideFields(content: HTMLElement): WholeField[] {
  const wide: WholeField[] = [];
  for (const el of content.querySelectorAll<HTMLElement>(
    `[${FIT_WHOLE_ATTR}]`,
  )) {
    const field = el.dataset.fitWhole;
    if (isWholeField(field) && el.scrollWidth - el.clientWidth > OVERFLOW_EPS) {
      wide.push(field);
    }
  }
  return wide;
}

/** Whether a word of the name is wider than the name's line. A name that may break inside a
 * word never overflows its box, so only a name held to its word boundaries can read true. */
function nameTooWide(content: HTMLElement): boolean {
  const name = content.querySelector<HTMLElement>(`[${FIT_NAME_ATTR}]`);
  return name !== null && name.scrollWidth - name.clientWidth > OVERFLOW_EPS;
}

/** Read how many lines the name renders and how many lines of content stand past the box, so
 * the ladder can clamp the name to what fits in one step. Layout sizes, not client rects, so a
 * scale transform on the poster stage never skews the count. Absent when the block has no
 * marked name or the line height does not resolve to pixels. */
function measureNameFit(
  content: HTMLElement,
  overflow: number,
): NameFit | undefined {
  const name = content.querySelector<HTMLElement>(`[${FIT_NAME_ATTR}]`);
  if (name === null) {
    return undefined;
  }
  const lineHeight = parseFloat(getComputedStyle(name).lineHeight);
  if (!(lineHeight > 0)) {
    return undefined;
  }
  return {
    lines: Math.max(1, Math.round(name.offsetHeight / lineHeight)),
    excessLines: Math.ceil((overflow - OVERFLOW_EPS) / lineHeight),
  };
}

/** Choose the field set for a block by measuring its content wrapper against its box.
 * `fitKey` encodes everything that changes the box pixel size, so a change resets the level
 * to full and re-measures. While `paused` the settled level holds and no measurement runs.
 * `ladder` names the drop order the block walks, the day card keeping its time longest. */
export function useDensityFit(
  ref: RefObject<HTMLElement | null>,
  eligibility: DensityEligibility,
  fitKey: string,
  paused = false,
  ladder: DensityLadder = 'block',
): DensityLevel {
  const fontsReady = useFontsReady();
  const resetKey = `${fitKey}|${ladder}|${eligibility.mask}|${fontsReady ? '1' : '0'}`;
  const [level, setLevel] = useState<DensityLevel>(() =>
    fullLevel(eligibility),
  );
  const settledKey = useRef<string | null>(null);
  // The fields a reclaim pass has tried since the last reset, so each is tried once.
  const reclaimTried = useRef<ReclaimField[]>([]);
  // The observer callback needs the current eligibility without re-subscribing every render.
  const eligibilityRef = useRef(eligibility);
  eligibilityRef.current = eligibility;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useLayoutEffect(() => {
    if (paused) {
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
      reclaimTried.current = [];
      const full = fullLevel(eligibility);
      if (!sameLevel(level, full)) {
        setLevel(full);
        return;
      }
    }
    // A whole field wider than its line drops at once: no rung can widen its line.
    const narrowed = dropWholeFields(level, measureWideFields(el));
    if (!sameLevel(level, narrowed)) {
      setLevel(narrowed);
      return;
    }
    // A name with a word wider than its line steps its form down: no rung widens its line.
    if (nameTooWide(el)) {
      const stepped = nextNameForm(level, eligibility.nameAbbreviations);
      if (stepped !== null) {
        setLevel(stepped);
        return;
      }
    }
    // Measure the committed content and demote one rung while it overflows either way.
    const overflow = el.scrollHeight - el.clientHeight;
    const overflowX = el.scrollWidth - el.clientWidth;
    if (overflow > OVERFLOW_EPS || overflowX > OVERFLOW_EPS) {
      const next = nextDensityLevel(
        level,
        measureNameFit(el, overflow),
        ladder,
      );
      if (next !== null) {
        setLevel(next);
      }
      return;
    }
    // The content fits. A field the walk dropped on the way down may fit again now that a
    // later rung freed its room, so offer it back once; if it overflows, the walk drops it
    // again, since the reclaimed fields are the top rungs.
    const reclaim = nextReclaim(
      level,
      eligibility,
      reclaimTried.current,
      ladder,
    );
    if (reclaim !== null) {
      reclaimTried.current = [...reclaimTried.current, reclaim.field];
      setLevel(reclaim.level);
    }
  });

  // The poster box does not settle in one frame: fonts and the gallery scale transform resolve
  // over the next few frames, and the block's box can change size then with no prop change,
  // so a single measurement can miss the final size. Observe the measured box and, whenever it
  // resizes, reset to the full field set so the convergence above re-runs against the settled
  // size. Resetting to a fresh full level always re-renders, which
  // re-arms the convergence even when the level was already full. Demoting a field never
  // resizes this box, which is flex sized by the grid cell, so the observer does not loop.
  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) {
      return undefined;
    }
    const observer = new ResizeObserver(() => {
      settledKey.current = null;
      if (!pausedRef.current) {
        setLevel(fullLevel(eligibilityRef.current));
      }
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [ref]);

  return level;
}
