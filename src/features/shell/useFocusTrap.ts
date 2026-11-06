// Keeps keyboard focus inside the overlay, or a nested modal layer, while it is
// open and routes Escape to a close callback. On activation it moves focus into
// the panel and remembers the opener; on deactivation it restores focus to the
// opener. It attaches its keydown listener to the panel element rather than the
// document, which is the correct place inside a closed shadow root: the
// isolateEvents guard stops keys only at the shadow body above the panel, so
// this listener still sees them, and host page scripts never do. Active focus is
// read through getRootNode so it stays correct in a closed shadow root, where
// document.activeElement reports only the host.
//
// Escape is decided later than Tab, recorded in ADR-0056. The panel listener runs
// before the React handlers delegated at the React root above it, so it hands the
// press to a one time listener on the panel's nearest body ancestor, the shadow
// body in the extension and the document body in tests. That node sits above the
// React root, so by the time the listener runs every inner surface, native or
// React, has had the press, and one that claimed it through claimEscape or its
// own preventDefault leaves the overlay open. The guard on the same body only
// stops propagation, which does not skip other listeners on that node. Nested
// traps hand off innermost first, because their panel listeners run in that
// order, so the innermost trap closes alone.

import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

// An inert subtree, such as the hidden docked catalog column, stays in the DOM but takes
// no focus, and neither does a node with no layout box, such as one under display none.
// The browser's Tab skips both, so neither may supply the first or last stop the wrap
// compares against: a skipped last stop would let Tab from the real last one leave the
// panel for the host page.
function isTabStop(element: HTMLElement): boolean {
  return (
    element.closest('[inert]') === null && element.getClientRects().length > 0
  );
}

function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter(isTabStop);
}

// getRootNode returns a Document or ShadowRoot at the top of the tree; both
// expose activeElement, but the Node return type does not, so narrow by instance.
export function activeElementWithin(node: Node): Element | null {
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

    const deciderNode: Node = panel.closest('body') ?? panel.getRootNode();
    // The decider for the latest handed off press. A press an inner surface stopped
    // before the body leaves it attached; the next key to reach the body removes it,
    // and the identity check keeps it from acting on that later key.
    let pendingDecider: ((settled: Event) => void) | null = null;
    const clearDecider = (): void => {
      if (pendingDecider !== null) {
        deciderNode.removeEventListener('keydown', pendingDecider);
        pendingDecider = null;
      }
    };

    const handOffEscape = (event: KeyboardEvent): void => {
      clearDecider();
      const decide = (settled: Event): void => {
        pendingDecider = null;
        if (settled !== event || event.defaultPrevented) return;
        const handleEscape = escapeRef.current;
        if (handleEscape === undefined) return;
        event.preventDefault();
        handleEscape();
      };
      pendingDecider = decide;
      deciderNode.addEventListener('keydown', decide, { once: true });
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        // A nested layer that already handled the press prevented its default, so a
        // nested trap or sheet closes alone and never takes the overlay with it. A
        // trap given no Escape callback leaves the press to the layer that owns it,
        // and the Escape that ends an input method composition belongs to the editor.
        if (
          event.defaultPrevented ||
          event.isComposing ||
          escapeRef.current === undefined
        ) {
          return;
        }
        handOffEscape(event);
        return;
      }
      // A nested trap that already wrapped this Tab prevented its default; acting on it
      // again here would read the stop the inner trap just moved to and wrap past it.
      if (event.key !== 'Tab' || event.defaultPrevented) return;
      const items = getFocusable(panel);
      const first = items[0];
      const last = items[items.length - 1];
      if (first === undefined || last === undefined) {
        // Nothing focusable inside; keep focus on the panel.
        event.preventDefault();
        return;
      }
      const current = activeElementWithin(panel);
      // Focus that sits on the panel itself or on a programmatic landing point, such as
      // a heading, is not a tab stop, so a native Shift+Tab from it would leave the trap.
      const onStop = current instanceof HTMLElement && items.includes(current);
      if (event.shiftKey && (current === first || !onStop)) {
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
      clearDecider();
      const previous = openerRef.current;
      if (previous?.isConnected) {
        previous.focus();
      }
    };
  }, [active, panelRef]);
}
