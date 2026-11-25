// When the read only observer reads the pre registration page (ADR-0077): once on arrival,
// then each time the watched roots settle for 150 ms. The reading is bounded. While the
// page shows none of the anchors, the watch sees only elements added or removed under the
// app root, and two readings are at least a second apart, so the countdown that the host
// build app.a1e43722 ticks every second above the panel, which rewrites its digits in
// place, reads nothing, and no change of the page can read it more than once a second.
// Once the panel shows, the watch keeps to the panel, its ancestors' children, the dialogs,
// and the toasts, outside of which the countdown sits. It reads and calls back, and does
// nothing else.

import type { PageReading } from './hostDom';
import { observedRoots } from './hostDom';

/** How long the watched roots stay still before the page is read again. */
export const SETTLE_MS = 150;

/** The least time between two readings while the page shows none of the anchors. */
export const WAITING_GAP_MS = 1000;

/** What one reading found, or that the observer turned off and the watch ends. */
export type WatchResult = PageReading['reading'] | 'off';

/**
 * Watch the page and call `read` on arrival and after each settle until it answers off.
 * Returns the function that ends the watch.
 */
export function watchHostPage(
  doc: Document,
  read: () => WatchResult,
  now: () => number = () => Date.now(),
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let last = Number.NEGATIVE_INFINITY;
  let absent = false;
  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    const gap = absent ? last + WAITING_GAP_MS - now() : 0;
    timer = setTimeout(evaluate, Math.max(SETTLE_MS, gap));
  });
  function evaluate() {
    last = now();
    observer.disconnect();
    const result = read();
    if (result === 'off') return;
    absent = result === 'absent';
    for (const [target, options] of observedRoots(doc, absent)) {
      observer.observe(target, options);
    }
  }
  evaluate();
  return () => {
    clearTimeout(timer);
    observer.disconnect();
  };
}
