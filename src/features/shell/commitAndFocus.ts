// The focus hand off shared by every control that turns inert or unmounts when it is
// pressed. It lives apart from the catalog column so a feature inside the column can
// use it without importing the column that renders it.

import { flushSync } from 'react-dom';

/**
 * Commits a visibility change, then moves focus to the control that replaces the one
 * just activated, since that control turns inert or unmounts with the change. The
 * target is found in the activating control's own root, which is the closed shadow
 * root in the extension, where the document lookup cannot reach. The root is read
 * before the commit, because a control the commit unmounts no longer reaches it. Focus
 * does not scroll, because the replacing control is already in view where it lands.
 */
export function commitAndFocus(
  from: Element,
  targetId: string,
  commit: () => void,
): void {
  const root = from.getRootNode();
  flushSync(commit);
  if (root instanceof Document || root instanceof ShadowRoot) {
    root.getElementById(targetId)?.focus({ preventScroll: true });
  }
}
