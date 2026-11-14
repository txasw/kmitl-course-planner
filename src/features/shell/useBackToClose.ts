// Closes the overlay on the system back gesture, recorded in ADR-0067. While active it holds
// one session history entry on top of the host's, with the same URL so the host router never
// sees a navigation, and a marker naming this opening as its state. A popstate while active
// means the student left that entry, so it calls onBack and leaves history alone. Any other
// close goes back once, and only when history still has the length and URL it had right after
// the push, so an entry someone else pushed is never unwound. It never reads history.state:
// Chromium caches that value per world and refreshes it only for the world that read it last,
// so once the page reads it the content script keeps seeing a stale value.
// A back is a queued traversal, so an opening that starts before the popstate of an earlier
// back waits for it, and the two traversals cannot cross.

import { useEffect, useRef } from 'react';

export const OVERLAY_HISTORY_MARKER = 'kcpOverlay';

interface PushedEntry {
  length: number;
  href: string;
}

let backPending = false;
const waiting = new Set<() => void>();

// Chromium lets the back gesture skip the entry below a push made without user activation,
// which would carry the student off the page they were on, so such an opening pushes nothing.
// The activation must be transient: Chromium stops honouring an earlier one after a same
// document back or forward, which every close by back is, so a reopening from the toolbar
// shortcut after it would still count as sticky but not as honoured.
function hasUserActivation(): boolean {
  return 'userActivation' in navigator
    ? navigator.userActivation.isActive
    : true;
}

function isStillOnTop(entry: PushedEntry): boolean {
  return (
    window.history.length === entry.length &&
    window.location.href === entry.href
  );
}

function goBack(): void {
  backPending = true;
  window.addEventListener(
    'popstate',
    () => {
      backPending = false;
      for (const run of [...waiting]) {
        waiting.delete(run);
        run();
      }
    },
    { once: true },
  );
  window.history.back();
}

function afterPendingBack(run: () => void): () => void {
  if (!backPending) {
    run();
    return () => undefined;
  }
  waiting.add(run);
  return () => {
    waiting.delete(run);
  };
}

export function useBackToClose(active: boolean, onBack: () => void): void {
  const onBackRef = useRef(onBack);

  // Keep the latest callback without pushing a fresh entry on every render.
  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  useEffect(() => {
    if (!active) return undefined;
    let pushed: PushedEntry | null = null;
    let popped = false;

    const handlePopState = (): void => {
      popped = true;
      onBackRef.current();
    };

    const push = (): void => {
      if (!hasUserActivation()) return;
      window.history.pushState(
        { [OVERLAY_HISTORY_MARKER]: crypto.randomUUID() },
        '',
      );
      pushed = {
        length: window.history.length,
        href: window.location.href,
      };
      window.addEventListener('popstate', handlePopState);
    };

    const cancelWait = afterPendingBack(push);
    return () => {
      cancelWait();
      if (pushed === null) return;
      window.removeEventListener('popstate', handlePopState);
      if (!popped && isStillOnTop(pushed)) goBack();
    };
  }, [active]);
}
