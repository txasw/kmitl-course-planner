// The focus moves shared by every control that unmounts, or turns inert, as a result of
// being pressed: an add button whose card collapses, a remove control whose block leaves
// the grid, a menu or popover that closes. Each move names the control that takes over,
// so focus never falls to the document body, where the overlay focus trap would only park
// it on the panel itself. Targets are looked up after the commit that replaces them, by
// data attribute or id, because a remount hands back a new node.

import { useEffect } from 'react';
import { flushSync } from 'react-dom';
import { activeElementWithin, focusIsLost, isTabStop } from './useFocusTrap';

type FocusTarget = HTMLElement | null | undefined;

/** Whether the element can take focus now: it is in the document, laid out, and live. */
export function canTakeFocus(element: HTMLElement): boolean {
  return element.isConnected && isTabStop(element);
}

/**
 * Focus the first candidate that can take focus and return it, or null when none can. A
 * candidate in an inert pane, such as the grid behind the open catalog sheet, is passed
 * over rather than focused in vain.
 */
export function focusFirst(
  candidates: Iterable<FocusTarget>,
  options?: FocusOptions,
): HTMLElement | null {
  for (const candidate of candidates) {
    if (candidate != null && canTakeFocus(candidate)) {
      candidate.focus(options);
      return candidate;
    }
  }
  return null;
}

/**
 * Commit a change that removes or replaces the focused control, then move focus to the
 * first target that can take it. The commit runs under flushSync, so the targets the
 * change renders exist when they are looked up, and the move lands before the focus trap
 * checks for dropped focus. The targets are computed from the commit's result, so an add
 * can pick one target when it lands and another when it is blocked. Returns that result.
 */
export function commitThenFocus<T>(
  commit: () => T,
  targets: (result: T) => Iterable<FocusTarget>,
  options?: FocusOptions,
): T {
  const result = flushSync(commit);
  focusFirst(targets(result), options);
  return result;
}

/**
 * Whether focus has nowhere useful to be: it is lost, or parked on a modal root, which is
 * where the focus trap puts focus that was dropped. A modal root is a landing point for
 * the whole layer, not a control, so a surface that closes may move focus off it.
 */
function focusIsParked(node: Node): boolean {
  if (focusIsLost(node)) return true;
  const active = activeElementWithin(node);
  return active?.getAttribute('aria-modal') === 'true';
}

/**
 * Return focus to the anchor that opened a surface when the surface unmounts, whichever
 * way it closed. It acts only when focus left with the surface, which is the case after
 * its close button, Escape, or an action inside it; an outside click that moved focus to
 * another control keeps it there. An anchor that left the document, such as a block the
 * remove action took out of the grid, is skipped, so the remove's own move stands.
 */
export function useReturnFocus(anchor: HTMLElement): void {
  useEffect(
    () => () => {
      if (!anchor.isConnected || !focusIsParked(anchor)) return;
      focusFirst([anchor]);
    },
    [anchor],
  );
}
