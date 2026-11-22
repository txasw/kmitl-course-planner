// Run one piece of async work at a time from a set of controls, such as an image export or a
// copy, and name the one running, so its control can show its busy state until the outcome
// toast (ADR-0027 amendment of 2026-11-22). A press while any work runs is ignored. The guard
// reads a ref rather than the state, so two presses in one frame, or a toast action that closes
// over an older render, still start only one run. The work reports its own outcome and settles
// without rejecting.

import { useRef, useState } from 'react';

export function useBusyAction<Action extends string>(): [
  running: Action | null,
  run: (action: Action, work: () => Promise<void>) => void,
] {
  const [running, setRunning] = useState<Action | null>(null);
  const busyRef = useRef(false);
  const run = (action: Action, work: () => Promise<void>) => {
    if (busyRef.current) {
      return;
    }
    const release = () => {
      busyRef.current = false;
      setRunning(null);
    };
    busyRef.current = true;
    setRunning(action);
    // The work starts within the press, so a share keeps its user activation. Work that
    // throws before it returns a promise, such as a missing clipboard, still frees the
    // controls, and the error reaches the press as it would without the guard.
    try {
      void work().finally(release);
    } catch (error) {
      release();
      throw error;
    }
  };
  return [running, run];
}
