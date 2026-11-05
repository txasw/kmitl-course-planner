// Reports whether a single line element clips its text, so a one line clamp offers its
// expand control only when there is hidden text to reveal. A catalog renders hundreds
// of rows and about half carry a condition or remark line, so every line shares one
// ResizeObserver rather than each row creating its own. The observer reports each
// target once when it starts observing and again whenever its box changes, which
// covers the first layout and a resized panel; a changed text re-observes the target
// so the new text is measured too. jsdom has no layout, so the line reads as fitting
// there and tests that need a clipped line stub the observer.

import { useEffect, useState, type RefObject } from 'react';

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

export function useTruncated(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  text: string,
): boolean {
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!active || node === null) {
      return undefined;
    }
    measures.set(node, () => {
      setTruncated(node.scrollWidth > node.clientWidth);
    });
    const observer = sharedObserver();
    observer.observe(node);
    return () => {
      observer.unobserve(node);
      measures.delete(node);
    };
  }, [ref, active, text]);

  return truncated;
}
