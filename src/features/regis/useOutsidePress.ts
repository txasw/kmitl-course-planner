// Calls back on a press anywhere outside a part of the helper: outside a menu and its
// trigger, or, for the card on a phone, outside KCP altogether. The press is compared with
// KCP's own nodes only and never read from the page; a press inside the closed shadow root
// carries the shadow host on its composed path.

import { useEffect, type RefObject } from 'react';
import { rootOf } from '@/features/shell/useFocusTrap';

export function useOutsidePress(
  ref: RefObject<HTMLElement | null>,
  on: boolean,
  onPress: () => void,
  /** Count a press anywhere in KCP as inside, not only one in this part. */
  wholeHost = false,
): void {
  useEffect(() => {
    const node = ref.current;
    if (!on || node === null) return undefined;
    const root = rootOf(node);
    const inside = wholeHost && root instanceof ShadowRoot ? root.host : node;
    const doc = node.ownerDocument;
    const handlePointerDown = (event: PointerEvent) => {
      if (!event.composedPath().includes(inside)) onPress();
    };
    doc.addEventListener('pointerdown', handlePointerDown, true);
    return () => {
      doc.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [ref, on, onPress, wholeHost]);
}
