// How the entry toast goes away, whatever ends it: the student's own controls, or a host
// route change under a route offer. When focus is inside the toast, the hide commits
// first and focus moves to the launcher, so it never falls back to the host page and the
// panel records the launcher as its opener. With focus elsewhere, the hide alone runs.

import { LAUNCHER_ID } from '@/features/shell/Launcher';
import { commitThenFocus } from '@/features/shell/restoreFocus';
import { activeElementWithin, rootOf } from '@/features/shell/useFocusTrap';

/** Ends the toast through end, handing focus to the launcher when it was in the box. */
export function leaveEntryToast(
  box: HTMLElement | null,
  end: () => void,
): void {
  const active = box === null ? null : activeElementWithin(box);
  if (box === null || active === null || !box.contains(active)) {
    end();
    return;
  }
  const root = rootOf(box);
  commitThenFocus(end, () => [root?.getElementById(LAUNCHER_ID)]);
}
