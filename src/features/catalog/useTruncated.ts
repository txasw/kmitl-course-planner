// Reports whether a line clamp clips its text, down its height or across its width for a
// word too long to break, so a clamp offers its expand control only when there is hidden
// text to reveal. It also reports where the hidden lines start (clampTail), so the clamp
// can paint them transparent and no mark of a hidden Thai line shows inside the clip. A
// catalog renders hundreds of rows and about half carry a condition or remark line, so every
// line shares one ResizeObserver rather than each row creating its own. The observer reports each target once when it starts observing and again
// whenever its box changes, which covers the first layout and a resized panel; a changed text
// re-observes the target so the new text is measured too. Painting the hidden part
// transparent never changes the box, so it never sets off another report. jsdom has no
// layout, so the line reads as fitting there and tests that need a clipped line stub the
// observer.

import { useEffect, useState, type RefObject } from 'react';
import { clampTailOffset } from './clampTail';

// A Thai face draws its marks a fraction past the line box, which can round the scroll
// height one pixel over a clamp that hides nothing.
const CLAMP_SLACK = 1;

const measures = new Map<Element, () => void>();
let shared: ResizeObserver | null = null;

function sharedObserver(): ResizeObserver {
  shared ??= new ResizeObserver((entries) => {
    for (const entry of entries) {
      measures.get(entry.target)?.();
    }
  });
  return shared;
}

interface Truncation {
  /** Whether the clamp hides any of the text. */
  clipped: boolean;
  /** The text offset where the hidden lines start, or null when none can be read. */
  tail: number | null;
}

interface Measured extends Truncation {
  text: string;
}

const FITS: Truncation = { clipped: false, tail: null };

/** Measure a line clamp of `lines` lines and locate its hidden part. */
export function useTruncated(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  text: string,
  lines: number,
): Truncation {
  const [measured, setMeasured] = useState<Measured>({ ...FITS, text });

  useEffect(() => {
    const node = ref.current;
    if (!active || node === null) {
      return undefined;
    }
    measures.set(node, () => {
      const clipped =
        node.scrollWidth > node.clientWidth ||
        node.scrollHeight > node.clientHeight + CLAMP_SLACK;
      const tail = clipped ? clampTailOffset(node, lines) : null;
      setMeasured((previous) =>
        previous.text === text &&
        previous.clipped === clipped &&
        previous.tail === tail
          ? previous
          : { text, clipped, tail },
      );
    });
    const observer = sharedObserver();
    observer.observe(node);
    return () => {
      observer.unobserve(node);
      measures.delete(node);
    };
  }, [ref, active, text, lines]);

  // A measure of an earlier text says nothing of where the new text breaks.
  return measured.text === text
    ? { clipped: measured.clipped, tail: measured.tail }
    : { clipped: measured.clipped, tail: null };
}
