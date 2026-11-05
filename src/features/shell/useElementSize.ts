// Tracks the client box of one element through a ResizeObserver, for layouts that scale or
// switch by the space a region actually has rather than by the viewport. It reads clientWidth
// and clientHeight, so padding counts and borders and scrollbars do not. The size starts at
// zero until the first measurement after mount, and an unchanged measurement keeps the same
// object, so an observer callback that reports the same box does not re-render the consumer.

import { useEffect, useState, type RefObject } from 'react';

export interface ElementSize {
  width: number;
  height: number;
}

const UNMEASURED: ElementSize = { width: 0, height: 0 };

export function useElementSize(
  ref: RefObject<HTMLElement | null>,
): ElementSize {
  const [size, setSize] = useState<ElementSize>(UNMEASURED);

  useEffect(() => {
    const node = ref.current;
    if (node === null) {
      return undefined;
    }
    const measure = () => {
      const width = node.clientWidth;
      const height = node.clientHeight;
      setSize((previous) =>
        previous.width === width && previous.height === height
          ? previous
          : { width, height },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [ref]);

  return size;
}
