// Calls back on a press anywhere outside a part of the helper: outside a menu and its
// trigger, or, for the card on a phone, outside KCP altogether. The press is compared with
// KCP's own nodes only and never read from the page.
//
// A listener on the document sees a press inside the closed shadow root retargeted to the
// shadow host: its composed path stops at the host and holds none of KCP's own nodes. So a
// press is judged in two places. The document, in the capture phase so the page cannot
// stop it first, decides a press outside KCP; the shadow root decides a press inside KCP,
// where the composed path still holds this part's nodes.

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
    const host = root instanceof ShadowRoot ? root.host : null;
    const doc = node.ownerDocument;
    const handleDocumentDown = (event: Event) => {
      const path = event.composedPath();
      // A press in KCP's shadow root is inside for the whole host, and otherwise left to
      // the root's own listener below.
      if (host !== null && path.includes(host)) return;
      if (!path.includes(node)) onPress();
    };
    const handleRootDown = (event: Event) => {
      if (!event.composedPath().includes(node)) onPress();
    };
    doc.addEventListener('pointerdown', handleDocumentDown, true);
    const inner = host !== null && !wholeHost ? root : null;
    inner?.addEventListener('pointerdown', handleRootDown, true);
    return () => {
      doc.removeEventListener('pointerdown', handleDocumentDown, true);
      inner?.removeEventListener('pointerdown', handleRootDown, true);
    };
  }, [ref, on, onPress, wholeHost]);
}
