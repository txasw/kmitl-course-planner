// Registers the jest-dom matchers (for example toBeInTheDocument) on Vitest's
// expect and augments its types.
import '@testing-library/jest-dom/vitest';

// jsdom does not implement matchMedia, which the reduced motion hook reads.
// Provide a minimal stub that reports motion enabled by default; individual
// tests override it to exercise the reduced motion path. The cast documents that
// this is a deliberate partial implementation of the MediaQueryList surface the
// code touches.
window.matchMedia = (query: string): MediaQueryList =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }) as MediaQueryList;

// jsdom does not implement ResizeObserver, which the preview stage uses to scale the
// export poster to fit its pane. A no op stub lets those components mount in tests; the
// scale math is exercised where it matters, in the E2E capture and the manual sweep.
class ResizeObserverStub implements ResizeObserver {
  observe(): void {
    /* no measurements in jsdom */
  }
  unobserve(): void {
    /* no measurements in jsdom */
  }
  disconnect(): void {
    /* no measurements in jsdom */
  }
}
globalThis.ResizeObserver = ResizeObserverStub;
