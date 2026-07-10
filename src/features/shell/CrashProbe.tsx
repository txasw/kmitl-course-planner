// Debug support only. Reads the ui store crash flag and throws when it is set, so the
// debug diagnostics drawer can trigger the panel error boundary for manual QA. It
// renders null otherwise. The render site in the overlay gates it behind the debug
// flag, so the bundler drops it from production; production never sets the flag either.
// The throw carries the debug canary, so if this module ever leaked into a production
// bundle the CI canary grep would fail the build, which is the automated guard that
// keeps the tree shaking honest.

import { useStore } from 'zustand';
import { uiStore } from './uiStore';

export function CrashProbe() {
  const armed = useStore(uiStore, (state) => state.crashPanel);
  if (armed) {
    // Clear the flag after this throwing render, so the recovery card's reload
    // recovers instead of re-throwing. The microtask runs once the boundary has
    // caught, and a later reset re-renders this probe with the flag already cleared.
    queueMicrotask(() => {
      uiStore.getState().setCrashPanel(false);
    });
    throw new Error(
      'panel crash probe (kcp-debug-canary): forced error for error boundary QA',
    );
  }
  return null;
}
