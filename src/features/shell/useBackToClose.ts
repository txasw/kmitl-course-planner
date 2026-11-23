// Closes a layer of the panel on the system back gesture, recorded in ADR-0067. While active
// each layer holds one session history entry on top of the host's, with the same URL so the
// host router never sees a navigation, and a marker naming this opening as its state. The
// layers that pushed form a stack, the overlay at the bottom and the shortcut help above it,
// and a popstate belongs to the topmost one only: it means the student left that entry, so
// that layer alone calls onBack and leaves history alone. Any other close goes back once, and
// only when history still has the length and URL the layer expects, so an entry someone else
// pushed is never unwound. The URL is compared through an opaque marker, so the layer never
// holds the address itself (ADR-0075). It never reads history.state: Chromium caches that value per world
// and refreshes it only for the world that read it last, so once the page reads it the content
// script keeps seeing a stale value.
// A back is a queued traversal whose popstate belongs to no layer, so an opening or a close
// that starts before the popstate of an earlier back waits for it, and the two traversals
// cannot cross.

import { useEffect, useRef } from 'react';
import { readLocationMarker } from './hostLocation';

export const OVERLAY_HISTORY_MARKER = 'kcpOverlay';

// A pushed entry is known by the history length after the push and an opaque marker of
// the address, never the address itself, which can carry a token or a student id
// (ADR-0075). Equal addresses give equal markers, so the check is unchanged.
interface PushedEntry {
  length: number;
  marker: string;
}

interface Layer {
  entry: PushedEntry;
  onBack: () => void;
}

const layers: Layer[] = [];
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
    readLocationMarker() === entry.marker
  );
}

// A run that goes back queues a traversal of its own, so the rest wait for its popstate.
function runWaiting(): void {
  for (const run of [...waiting]) {
    if (backPending) return;
    waiting.delete(run);
    run();
  }
}

function handlePopState(): void {
  if (backPending) {
    backPending = false;
    runWaiting();
  } else {
    const top = layers.at(-1);
    if (top !== undefined) {
      removeLayer(top);
      top.onBack();
    }
  }
  syncListener();
}

function syncListener(): void {
  if (backPending || layers.length > 0) {
    window.addEventListener('popstate', handlePopState);
  } else {
    window.removeEventListener('popstate', handlePopState);
  }
}

// A traversal never changes history.length, so the layer below the one leaving takes over the
// length the leaving layer saw, which still counts the entry left above as a forward entry.
// It reports whether the layer was on top, since only the top one may unwind its entry.
function removeLayer(layer: Layer): boolean {
  const index = layers.indexOf(layer);
  if (index === -1) return false;
  layers.splice(index, 1);
  const wasTop = index === layers.length;
  const below = layers.at(-1);
  if (wasTop && below !== undefined) below.entry.length = layer.entry.length;
  syncListener();
  return wasTop;
}

function goBack(): void {
  backPending = true;
  syncListener();
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
    let layer: Layer | null = null;

    const push = (): void => {
      if (!hasUserActivation()) return;
      window.history.pushState(
        { [OVERLAY_HISTORY_MARKER]: crypto.randomUUID() },
        '',
      );
      layer = {
        entry: {
          length: window.history.length,
          marker: readLocationMarker(),
        },
        onBack: () => {
          onBackRef.current();
        },
      };
      layers.push(layer);
      syncListener();
    };

    const cancelWait = afterPendingBack(push);
    // A layer nested in the React tree cleans up before its parent, so the layers close top
    // down; one that is no longer on top, or already left by a back, unwinds nothing.
    return () => {
      cancelWait();
      if (layer === null || !removeLayer(layer)) return;
      const { entry } = layer;
      afterPendingBack(() => {
        if (isStillOnTop(entry)) goBack();
      });
    };
  }, [active]);
}
