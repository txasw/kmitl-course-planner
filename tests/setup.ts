// Registers the jest-dom matchers (for example toBeInTheDocument) on Vitest's
// expect and augments its types.
import '@testing-library/jest-dom/vitest';

// jsdom does not implement matchMedia, which the reduced motion hook reads.
// Provide a minimal stub that reports motion enabled by default; individual
// tests override it to exercise the reduced motion path. The cast documents that
// this is a deliberate partial implementation of the MediaQueryList surface the
// code touches, so it omits the deprecated addListener pair the code never calls.
window.matchMedia = (query: string): MediaQueryList =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;

// jsdom does not implement ResizeObserver, which the preview stage uses to scale the
// export poster to fit its pane. A no op stub lets those components mount in tests; a test
// that exercises the scale math stubs its own observer and fires the resizes by hand.
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

// jsdom does not implement the Web Animations API, which the catalog slide reads to cancel
// a running slide before it starts the next. No running effects is the honest answer for an
// element jsdom never animates; a test that exercises the slide stubs animate and
// getAnimations with its own recording fakes.
Element.prototype.getAnimations = () => [];

// jsdom lays nothing out, so getClientRects is empty for every element, where a browser
// returns a box for anything it renders. The focus trap skips a node with no box, as the
// browser's Tab does, so report one empty box unless the node or an ancestor is hidden or
// set to display none. The cast documents that this is a deliberate partial list: the
// code reads only its length.
function isLaidOut(element: Element): boolean {
  if (
    element.hasAttribute('hidden') ||
    window.getComputedStyle(element).display === 'none'
  ) {
    return false;
  }
  return element.parentElement === null || isLaidOut(element.parentElement);
}
Element.prototype.getClientRects = function getClientRects(
  this: Element,
): DOMRectList {
  return (isLaidOut(this) ? [new DOMRect()] : []) as unknown as DOMRectList;
};
