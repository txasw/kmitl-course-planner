import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { HelperViewport, visibleProperty } from './HelperViewport';

// The helper's fixed layers follow the part of a wide page the screen shows: the probe's
// parent carries the band on each side as custom properties, and loses them on leave.

class FakeViewport extends EventTarget {
  offsetLeft = 0;
  offsetTop = 0;
  width = 390;
  height = 844;
  scale = 1;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, 'visualViewport');
});

function renderOn(viewport: FakeViewport) {
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: viewport,
  });
  // The probe fills a layout viewport a 497 px wide page grew to.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    DOMRect.fromRect({ x: 0, y: 0, width: 497, height: 1076 }),
  );
  return render(<HelperViewport />);
}

describe('HelperViewport', () => {
  it('sets the bands around the screen on its parent and follows a pan', () => {
    const viewport = new FakeViewport();
    const view = renderOn(viewport);
    const parent = view.container;
    const read = (side: Parameters<typeof visibleProperty>[0]) =>
      parent.style.getPropertyValue(visibleProperty(side));
    expect([read('right'), read('bottom'), read('height')]).toEqual([
      '107px',
      '232px',
      '844px',
    ]);
    act(() => {
      viewport.offsetLeft = 60;
      viewport.dispatchEvent(new Event('scroll'));
    });
    expect([read('left'), read('right')]).toEqual(['60px', '47px']);
    view.unmount();
    expect(read('right')).toBe('');
  });

  it('sets nothing while the screen shows the whole layout viewport', () => {
    const viewport = new FakeViewport();
    viewport.width = 497;
    viewport.height = 1076;
    const view = renderOn(viewport);
    expect(view.container.getAttribute('style')).toBeNull();
  });
});
