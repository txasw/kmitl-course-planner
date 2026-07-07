// Keeps keyboard focus inside the overlay while it is open and routes Escape to
// a close callback. On activation it moves focus into the panel and remembers
// the opener; on deactivation it restores focus to the opener. It attaches its
// keydown listener to the panel element rather than the document, which is the
// correct place inside a closed shadow root: the isolateEvents guard stops keys
// only at the shadow host above the panel, so this listener still sees them, and
// host page scripts never do. Active focus is read through getRootNode so it
// stays correct in a closed shadow root, where document.activeElement reports
// only the host.

import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

// getRootNode returns a Document or ShadowRoot at the top of the tree; both
// expose activeElement, but the Node return type does not, so narrow by instance.
function activeElementWithin(node: Node): Element | null {
  const root = node.getRootNode();
  if (root instanceof Document || root instanceof ShadowRoot) {
    return root.activeElement;
  }
  return null;
}

export function useFocusTrap(
  panelRef: RefObject<HTMLElement | null>,
  active: boolean,
  onEscape?: () => void,
): void {
  const openerRef = useRef<HTMLElement | null>(null);
  const escapeRef = useRef<(() => void) | undefined>(onEscape);

  // Keep the latest callback without re-running the trap effect, which would
  // re-capture the opener and steal focus back to the panel on every render.
  useEffect(() => {
    escapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!active) return;
    const panel = panelRef.current;
    if (panel === null) return;

    const opener = activeElementWithin(panel);
    openerRef.current = opener instanceof HTMLElement ? opener : null;
    panel.focus();

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        escapeRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = getFocusable(panel);
      const first = items[0];
      const last = items[items.length - 1];
      if (first === undefined || last === undefined) {
        // Nothing focusable inside; keep focus on the panel.
        event.preventDefault();
        return;
      }
      const current = activeElementWithin(panel);
      if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    panel.addEventListener('keydown', onKeyDown);
    return () => {
      panel.removeEventListener('keydown', onKeyDown);
      const previous = openerRef.current;
      if (previous?.isConnected) {
        previous.focus();
      }
    };
  }, [active, panelRef]);
}
