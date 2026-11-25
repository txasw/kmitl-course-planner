// Calls back on a tap anywhere outside a part of the helper: outside a menu and its
// trigger, or, for the card on a phone, outside KCP altogether. The press is compared with
// KCP's own nodes only and never read from the page.
//
// A press counts as a tap only once it ends where it began: the pointer comes up having
// moved less than TAP_SLOP pixels, with no second finger down, no scroll in between, and
// no pointercancel, which a touch browser sends when it takes the gesture over to scroll
// or zoom. So the start of a scroll or a pinch on the host page is never a tap, and
// scrolling the page never closes a menu or collapses the card.
//
// A listener on the document sees a press inside the closed shadow root retargeted to the
// shadow host: its composed path stops at the host and holds none of KCP's own nodes. So a
// press is judged in two places. The document, in the capture phase so the page cannot
// stop it first, decides a press outside KCP; the shadow root decides a press inside KCP,
// where the composed path still holds this part's nodes. Where the press began decides
// whether it was outside; the rest of the gesture is followed on the document.

import { useEffect, type RefObject } from 'react';
import { rootOf } from '@/features/shell/useFocusTrap';

/** How far a pointer may move between down and up and still count as a tap, in px. */
export const TAP_SLOP = 10;

interface Start {
  id: number;
  x: number;
  y: number;
}

function pointerId(event: Event): number {
  return 'pointerId' in event && typeof event.pointerId === 'number'
    ? event.pointerId
    : 0;
}

function startOf(event: Event): Start {
  return event instanceof MouseEvent
    ? { id: pointerId(event), x: event.clientX, y: event.clientY }
    : { id: pointerId(event), x: 0, y: 0 };
}

function movedFrom(start: Start, event: Event): boolean {
  if (!(event instanceof MouseEvent)) return false;
  return (
    Math.hypot(event.clientX - start.x, event.clientY - start.y) >= TAP_SLOP
  );
}

// A browser that sends no isPrimary is treated as one pointer at a time.
function isPrimary(event: Event): boolean {
  return !('isPrimary' in event) || event.isPrimary !== false;
}

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
    // The pointers down now, so a second finger marks the gesture a pinch, and the
    // outside press waiting for its pointer to come up, if any.
    const down = new Set<number>();
    let pending: Start | null = null;

    const handleDocumentDown = (event: Event) => {
      // A new primary pointer starts a new gesture, so an up the page swallowed earlier
      // never leaves a pointer counted as down.
      if (isPrimary(event)) down.clear();
      down.add(pointerId(event));
      if (down.size > 1) {
        pending = null;
        return;
      }
      pending = null;
      const path = event.composedPath();
      // A press in KCP's shadow root is inside for the whole host, and otherwise left to
      // the root's own listener below.
      if (host !== null && path.includes(host)) return;
      if (!path.includes(node)) pending = startOf(event);
    };
    const handleRootDown = (event: Event) => {
      if (down.size > 1) return;
      if (!event.composedPath().includes(node)) pending = startOf(event);
    };
    const handleMove = (event: Event) => {
      if (pending?.id === pointerId(event) && movedFrom(pending, event)) {
        pending = null;
      }
    };
    const handleUp = (event: Event) => {
      const id = pointerId(event);
      down.delete(id);
      const start = pending;
      if (start?.id !== id) return;
      pending = null;
      if (!movedFrom(start, event)) onPress();
    };
    const handleCancel = (event: Event) => {
      down.delete(pointerId(event));
      pending = null;
    };
    const handleScroll = () => {
      pending = null;
    };

    doc.addEventListener('pointerdown', handleDocumentDown, true);
    doc.addEventListener('pointermove', handleMove, true);
    doc.addEventListener('pointerup', handleUp, true);
    doc.addEventListener('pointercancel', handleCancel, true);
    doc.addEventListener('scroll', handleScroll, true);
    const inner = host !== null && !wholeHost ? root : null;
    inner?.addEventListener('pointerdown', handleRootDown, true);
    return () => {
      doc.removeEventListener('pointerdown', handleDocumentDown, true);
      doc.removeEventListener('pointermove', handleMove, true);
      doc.removeEventListener('pointerup', handleUp, true);
      doc.removeEventListener('pointercancel', handleCancel, true);
      doc.removeEventListener('scroll', handleScroll, true);
      inner?.removeEventListener('pointerdown', handleRootDown, true);
    };
  }, [ref, on, onPress, wholeHost]);
}
