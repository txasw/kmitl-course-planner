// Grows a text area to the height of its whole value, so a one line field such as the plan
// name shows a long value wrapped onto the lines it needs rather than scrolled sideways to
// its end with its first glyphs cut at the field edge. The height is set before the browser
// paints on each change of the value, and again when the field's width changes, since a
// narrower field wraps the same value onto more lines. Only the width is watched, so the
// height this hook sets never feeds back into another measurement.

import { useCallback, useEffect, useLayoutEffect, type RefObject } from 'react';

/** Set a text area's height to hold its whole value, borders included. */
export function fitFieldHeight(node: HTMLTextAreaElement): void {
  node.style.height = 'auto';
  const borders = node.offsetHeight - node.clientHeight;
  node.style.height = `${String(node.scrollHeight + borders)}px`;
}

export function useGrowingField(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
): void {
  const fit = useCallback(() => {
    if (ref.current !== null) {
      fitFieldHeight(ref.current);
    }
  }, [ref]);

  useLayoutEffect(() => {
    fit();
  }, [fit, value]);

  useEffect(() => {
    const node = ref.current;
    if (node === null) {
      return undefined;
    }
    let width = node.clientWidth;
    const observer = new ResizeObserver(() => {
      if (node.clientWidth !== width) {
        width = node.clientWidth;
        fit();
      }
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [ref, fit]);
}
