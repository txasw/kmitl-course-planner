// Closes the overlay on the system back gesture, recorded in ADR-0067. While active it holds
// one session history entry on top of the host's, with the same URL so the host router never
// sees a navigation, and a state copied from the current one so the router's key survives,
// plus a marker naming this opening. A popstate while active means the student left that
// entry, so it calls onBack and leaves history alone. Any other close goes back once, and only
// when the marked entry is still on top, so an entry someone else pushed is never unwound.
// A back is a queued traversal, so an opening that starts before the popstate of an earlier
// back waits for it, and the two traversals cannot cross.

import { useEffect, useRef } from 'react';

export const OVERLAY_HISTORY_MARKER = 'kcpOverlay';

type HistoryState = Record<string, unknown> | null;

let backPending = false;
const waiting = new Set<() => void>();

function readCopyableState(): HistoryState | undefined {
  const state: unknown = window.history.state;
  if (state === null) return null;
  if (typeof state !== 'object' || Array.isArray(state)) return undefined;
  return { ...state };
}

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

function isMarked(state: unknown, token: string): boolean {
  return (
    typeof state === 'object' &&
    state !== null &&
    OVERLAY_HISTORY_MARKER in state &&
    state[OVERLAY_HISTORY_MARKER] === token
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
    const token = crypto.randomUUID();
    let pushed = false;
    let popped = false;

    const handlePopState = (): void => {
      popped = true;
      onBackRef.current();
    };

    const push = (): void => {
      const state = readCopyableState();
      if (state === undefined || !hasUserActivation()) return;
      window.history.pushState(
        { ...state, [OVERLAY_HISTORY_MARKER]: token },
        '',
      );
      pushed = true;
      window.addEventListener('popstate', handlePopState);
    };

    const cancelWait = afterPendingBack(push);
    return () => {
      cancelWait();
      if (!pushed) return;
      window.removeEventListener('popstate', handlePopState);
      if (!popped && isMarked(window.history.state, token)) goBack();
    };
  }, [active]);
}
