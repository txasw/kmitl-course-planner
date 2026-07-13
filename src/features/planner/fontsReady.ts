// One shared signal for whether the document's fonts have finished loading. The block fit
// measurement (`useDensityFit`) and the poster capture (`capturePng`) must both read glyph
// metrics only after fonts are ready, or a block measured on a fallback font would choose a
// field set the final raster does not match. Every block subscribes to this one store rather
// than each awaiting its own promise, so a poster of dozens of blocks re-measures once when
// the fonts settle. When the platform exposes no font loading API, as jsdom does not, the
// signal starts ready so the tests and any such host behave as if fonts were already present.

import { useSyncExternalStore } from 'react';

let ready = false;
const listeners = new Set<() => void>();

function markReady(): void {
  if (ready) {
    return;
  }
  ready = true;
  for (const listener of listeners) {
    listener();
  }
}

// The DOM types fonts as always present, but jsdom omits it, so read it through a widened
// binding rather than a check the types would call redundant.
const fontSet: FontFaceSet | undefined =
  typeof document !== 'undefined' ? document.fonts : undefined;
if (fontSet !== undefined) {
  void fontSet.ready.then(markReady);
} else {
  ready = true;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): boolean {
  return ready;
}

/** Whether the document's fonts have loaded. Flips from false to true once and stays. */
export function useFontsReady(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
