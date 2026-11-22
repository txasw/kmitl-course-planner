import { describe, it, expect, vi, afterEach } from 'vitest';
import { toBlob } from 'html-to-image';
import { shadowToken } from '../../../tests/support/contrast';
import { CAPTURE_BACKGROUND, capturePng } from './capture';

vi.mock('html-to-image', () => ({ toBlob: vi.fn() }));

afterEach(() => {
  vi.restoreAllMocks();
});

// The poster blocks take the soft depth card (ADR-0047 amendment of 2026-11-22), and the export
// rasterizes them over the capture background. The card mixes its tint into the surface token,
// so the image paints the stops the palette suite in hash-color.test.ts proves only while the
// two agree, which this pins.

describe('poster capture background', () => {
  it('is the surface the soft card mixes its tint into', () => {
    expect(CAPTURE_BACKGROUND.toLowerCase()).toBe(
      shadowToken('surface').toLowerCase(),
    );
  });
});

/** A computed style holding the given values. jsdom computes neither a line clamp nor the
 * flow-root Chromium reads back for a clamped box, so the test supplies both. */
function computed(values: Record<string, string>): CSSStyleDeclaration {
  // Test only assertion: the capture reads the display and property values alone.
  return {
    display: values.display,
    getPropertyValue: (name: string) => values[name] ?? '',
  } as unknown as CSSStyleDeclaration;
}

describe('poster capture line clamp', () => {
  it('reads a clamped box as the clamp display while the image is taken', async () => {
    const clamped = document.createElement('span');
    const plain = document.createElement('span');
    const read = vi
      .spyOn(window, 'getComputedStyle')
      .mockImplementation((node) =>
        computed({
          display: 'flow-root',
          '-webkit-line-clamp': node === clamped ? '2' : 'none',
        }),
      );
    const seen: string[] = [];
    vi.mocked(toBlob).mockImplementation(() => {
      const style = window.getComputedStyle(clamped);
      seen.push(
        style.getPropertyValue('display'),
        style.display,
        style.getPropertyValue('-webkit-line-clamp'),
        window.getComputedStyle(plain).getPropertyValue('display'),
      );
      return Promise.resolve(new Blob(['png']));
    });

    await capturePng(document.createElement('div'));

    expect(seen).toEqual(['-webkit-box', '-webkit-box', '2', 'flow-root']);
    // Once the image is taken the page reads its own computed style again.
    expect(window).toHaveProperty('getComputedStyle', read);
    expect(window.getComputedStyle(clamped).display).toBe('flow-root');
  });

  it('restores the computed style when the capture fails', async () => {
    const read = vi
      .spyOn(window, 'getComputedStyle')
      .mockImplementation(() => computed({ display: 'block' }));
    vi.mocked(toBlob).mockRejectedValue(new Error('no canvas'));

    await expect(capturePng(document.createElement('div'))).rejects.toThrow(
      'no canvas',
    );
    expect(window).toHaveProperty('getComputedStyle', read);
  });
});

// The clone runs as one long stretch of microtasks, so started inside a frame callback it
// would hold back that frame's paint and the busy state the press committed would show only
// once the clone was done. The capture starts in a task after the frame instead.
describe('poster capture start', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(document, 'fonts');
  });

  it('starts the clone in a task after the next frame, so the busy state paints first', async () => {
    const order: string[] = [];
    let frame: FrameRequestCallback = () => undefined;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frame = callback;
      return 1;
    });
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { ready: Promise.resolve() },
    });
    vi.mocked(toBlob).mockImplementation(() => {
      order.push('clone');
      return Promise.resolve(new Blob(['png']));
    });

    const capture = capturePng(document.createElement('div'));
    await Promise.resolve();
    await Promise.resolve();
    order.push('frame');
    frame(0);
    // Every microtask the frame queued has run, and still no clone has started.
    await Promise.resolve();
    await Promise.resolve();
    order.push('frame painted');
    await capture;
    expect(order).toEqual(['frame', 'frame painted', 'clone']);
  });
});
