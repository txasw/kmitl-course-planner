// A viewport width fake for component tests. jsdom has no layout, so this stubs
// matchMedia to evaluate min width queries against a width the test sets, and a resize
// notifies every query whose match flipped, the way a real MediaQueryList does. The
// reduced motion and coarse pointer queries match only when asked for, so a test can mount
// transitions instantly or stand in for a touch screen, and any other query reports no
// match. Callers undo the stub with vi.unstubAllGlobals.

import { vi } from 'vitest';

const MIN_WIDTH = /^\(min-width: (\d+)px\)$/;
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const COARSE_POINTER = '(pointer: coarse)';

function minWidthMatches(query: string, width: number): boolean {
  const match = MIN_WIDTH.exec(query);
  return match?.[1] !== undefined && width >= Number(match[1]);
}

export interface FakeViewport {
  resize: (width: number) => void;
}

export function installViewport(
  initialWidth: number,
  {
    reducedMotion = false,
    coarsePointer = false,
  }: { reducedMotion?: boolean; coarsePointer?: boolean } = {},
): FakeViewport {
  let width = initialWidth;
  const matchesAt = (query: string, at: number): boolean => {
    if (query === REDUCED_MOTION) return reducedMotion;
    if (query === COARSE_POINTER) return coarsePointer;
    return minWidthMatches(query, at);
  };
  const listeners = new Map<string, Set<() => void>>();
  const listenersFor = (query: string): Set<() => void> => {
    const existing = listeners.get(query);
    if (existing !== undefined) return existing;
    const created = new Set<() => void>();
    listeners.set(query, created);
    return created;
  };

  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return matchesAt(query, width);
    },
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: () => void) => {
      listenersFor(query).add(listener);
    },
    removeEventListener: (_type: string, listener: () => void) => {
      listenersFor(query).delete(listener);
    },
    dispatchEvent: () => false,
  }));

  return {
    resize(next) {
      const previous = width;
      width = next;
      for (const [query, set] of listeners) {
        if (matchesAt(query, previous) !== matchesAt(query, next)) {
          for (const listener of set) listener();
        }
      }
    },
  };
}
