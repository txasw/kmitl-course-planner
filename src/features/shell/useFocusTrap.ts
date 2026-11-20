// Keeps keyboard focus inside the overlay, or a nested modal layer, while it is
// open and routes Escape to a close callback. On activation it moves focus into
// the panel and remembers the opener, unless a nested layer mounted with it already
// holds focus inside; on deactivation it restores focus to the opener. It attaches its keydown listener to the panel element rather than the
// document, which is the correct place inside a closed shadow root: the
// isolateEvents guard stops keys only at the shadow root above the panel, so
// this listener still sees them, and host page scripts never do. Active focus is
// read through getRootNode so it stays correct in a closed shadow root, where
// document.activeElement reports only the host.
//
// Escape is decided later than Tab, recorded in ADR-0056. The panel listener runs
// before the React handlers delegated at the React root above it, so it hands the
// press to a one time listener on the panel's root node, the shadow root in the
// extension and the document in tests. That node sits above the React root, so by
// the time the listener runs every inner surface, native or React, has had the
// press, and one that claimed it through claimEscape or its own preventDefault
// leaves the overlay open. The guard on the shadow root only stops propagation,
// which does not skip other listeners on that node. Nested
// traps hand off innermost first, because their panel listeners run in that
// order, so the innermost trap closes alone.
//
// A control that unmounts while it holds focus, such as an add button whose card
// collapses, drops focus to the document body outside the shadow root, where the panel
// listener never sees the next key, so Tab would leave for the host page and Escape
// would stop working. The features move focus on purpose after such a change; as a
// backstop the trap pulls focus that was dropped back onto the panel.
//
// A trap can name satellite regions by id: nodes in the same root that sit outside the
// panel but belong to its Tab order, as the toast region does, which stays on its own
// layer above the panel. Their tab stops follow the panel's last stop, so Tab from the
// panel's last control reaches a toast action and Tab from the toast's last control wraps
// to the panel's first. The trap never moves focus into a satellite when one fills, so a
// toast that appears never takes focus from the control in use. A satellite gets the same
// keydown and focusout listeners as the panel, so a Tab or a dropped focus there is
// handled as it is inside the panel.

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
export function isTabStop(element: HTMLElement): boolean {
  return (
    element.closest('[inert]') === null && element.getClientRects().length > 0
  );
}

function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter(isTabStop);
}

/**
 * The document or shadow root the node lives in, or null for a detached node, whose
 * getRootNode is the top of its own subtree. Both roots expose activeElement and the id
 * lookup, but the Node return type does not, so narrow by instance.
 */
export function rootOf(node: Node): Document | ShadowRoot | null {
  const root = node.getRootNode();
  return root instanceof Document || root instanceof ShadowRoot ? root : null;
}

export function activeElementWithin(node: Node): Element | null {
  return rootOf(node)?.activeElement ?? null;
}

/**
 * Whether no live control in the node's root holds focus: focus fell to the body, as it
 * does when its holder unmounts, or it sits in a subtree that turned inert, which the
 * browser is about to blur. In a closed shadow root activeElement is null once focus
 * leaves it, where the document reports its body instead. A detached node has no root
 * to ask, so it reports false.
 */
export function focusIsLost(node: Node): boolean {
  const root = rootOf(node);
  if (root === null) return false;
  const active = root.activeElement;
  return (
    active === null ||
    active === active.ownerDocument.body ||
    active.closest('[inert]') !== null
  );
}

const NO_SATELLITES: readonly string[] = [];

export function useFocusTrap(
  panelRef: RefObject<HTMLElement | null>,
  active: boolean,
  onEscape?: () => void,
  satelliteIds: readonly string[] = NO_SATELLITES,
): void {
  const openerRef = useRef<HTMLElement | null>(null);
  const escapeRef = useRef<(() => void) | undefined>(onEscape);
  const satelliteIdsRef = useRef(satelliteIds);

  useEffect(() => {
    satelliteIdsRef.current = satelliteIds;
  }, [satelliteIds]);

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
    if (opener !== null && opener !== panel && panel.contains(opener)) {
      // A nested layer that mounted in the same commit already took focus, since a child's
      // effect runs before its parent's, as when the panel opens with a sheet or dialog
      // shown. Focus stays in that layer, and a node inside this panel is no opener.
      openerRef.current = null;
    } else {
      openerRef.current = opener instanceof HTMLElement ? opener : null;
      panel.focus();
    }

    const deciderNode: Node = panel.getRootNode();
    const root = rootOf(panel);
    const satellites = (): HTMLElement[] =>
      satelliteIdsRef.current.flatMap((id) => {
        const node = root?.getElementById(id);
        return node instanceof HTMLElement && !panel.contains(node)
          ? [node]
          : [];
      });
    // The decider for the latest handed off press. A press an inner surface stopped
    // before the root leaves it attached; the next key to reach the root removes it,
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
      const own = getFocusable(panel);
      const extra = satellites().flatMap(getFocusable);
      const items = [...own, ...extra];
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
      // The satellites sit elsewhere in the document, so the step between the panel's
      // last stop and a satellite's first is moved by hand in both directions.
      const ownLast = own[own.length - 1];
      const extraFirst = extra[0];
      const move = (target: HTMLElement | undefined): void => {
        if (target === undefined) return;
        event.preventDefault();
        target.focus();
      };
      if (event.shiftKey) {
        if (current === first || !onStop) {
          move(last);
        } else if (current === extraFirst) {
          move(ownLast);
        }
      } else if (current === last) {
        move(first);
      } else if (current === ownLast && extraFirst !== undefined) {
        move(extraFirst);
      }
    };

    // A drop shows as a focusout that names no new target. Moving to another control,
    // inside the panel or out of it, names one, and so does nothing else here. The check
    // waits a microtask, so a handler that moves focus on purpose right after the commit
    // that dropped it, such as commitAndFocus, has done so before the trap looks; focus
    // that sits on any live control by then, or that never left because the window lost
    // focus, is left alone. A nested trap runs first and keeps focus inside its own layer.
    const onFocusOut = (event: FocusEvent): void => {
      if (event.relatedTarget !== null) return;
      queueMicrotask(() => {
        if (panel.isConnected && focusIsLost(panel)) {
          panel.focus({ preventScroll: true });
        }
      });
    };

    // A satellite carries no Escape of its own here: its controls claim the press they
    // handle, and an unclaimed one reaches the same decider through this listener.
    const listened = [panel, ...satellites()];
    for (const node of listened) {
      node.addEventListener('keydown', onKeyDown);
      node.addEventListener('focusout', onFocusOut);
    }
    return () => {
      for (const node of listened) {
        node.removeEventListener('keydown', onKeyDown);
        node.removeEventListener('focusout', onFocusOut);
      }
      clearDecider();
      const previous = openerRef.current;
      if (previous?.isConnected) {
        previous.focus();
      }
    };
  }, [active, panelRef]);
}
