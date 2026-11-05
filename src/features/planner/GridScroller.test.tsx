import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { GridScroller } from './GridScroller';
import { scrollEdges, type ScrollMetrics } from './useScrollEdges';

const FITS: ScrollMetrics = {
  scrollLeft: 0,
  scrollTop: 0,
  scrollWidth: 600,
  scrollHeight: 400,
  clientWidth: 600,
  clientHeight: 400,
  offsetWidth: 600,
  offsetHeight: 400,
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('scrollEdges', () => {
  it('marks no side when the content fits', () => {
    expect(scrollEdges(FITS)).toMatchObject({
      left: false,
      right: false,
      top: false,
      bottom: false,
    });
  });

  it('marks only the trailing side at the start of a wide grid', () => {
    expect(scrollEdges({ ...FITS, scrollWidth: 768 })).toMatchObject({
      left: false,
      right: true,
    });
  });

  it('marks both sides mid scroll and only the leading side at the end', () => {
    const wide = { ...FITS, scrollWidth: 768 };
    expect(scrollEdges({ ...wide, scrollLeft: 80 })).toMatchObject({
      left: true,
      right: true,
    });
    expect(scrollEdges({ ...wide, scrollLeft: 168 })).toMatchObject({
      left: true,
      right: false,
    });
  });

  it('ignores a sub pixel remainder from a fractional scroll offset', () => {
    expect(
      scrollEdges({ ...FITS, scrollWidth: 768, scrollLeft: 167.5 }),
    ).toMatchObject({ right: false });
  });

  it('measures the scrollbars so a trailing fade sits inside them', () => {
    expect(
      scrollEdges({ ...FITS, clientWidth: 585, clientHeight: 385 }),
    ).toMatchObject({ scrollbarX: 15, scrollbarY: 15 });
  });
});

describe('GridScroller', () => {
  function stubMetrics(node: HTMLElement, metrics: Partial<ScrollMetrics>) {
    for (const [key, value] of Object.entries({ ...FITS, ...metrics })) {
      Object.defineProperty(node, key, { configurable: true, value });
    }
  }

  it('renders no fade when the grid fits its column', () => {
    const { container } = render(<GridScroller>{() => <div />}</GridScroller>);
    expect(container.querySelector('[data-edge-fade]')).toBeNull();
  });

  it('fades the side that still hides content as the grid scrolls', () => {
    const { container } = render(<GridScroller>{() => <div />}</GridScroller>);
    const scroller = container.querySelector('.overflow-auto');
    if (!(scroller instanceof HTMLElement)) {
      throw new Error('expected the scroller');
    }
    stubMetrics(scroller, { scrollWidth: 768, scrollLeft: 80 });
    act(() => {
      fireEvent.scroll(scroller);
    });
    const fades = Array.from(
      container.querySelectorAll<HTMLElement>('[data-edge-fade]'),
    );
    expect(fades.map((fade) => fade.dataset.edgeFade)).toEqual([
      'left',
      'right',
    ]);
    for (const fade of fades) {
      expect(fade).toHaveAttribute('aria-hidden');
    }
    // The leading fade starts past the sticky day column and its edge rule.
    expect(fades[0]?.style.left).toBe('41px');

    stubMetrics(scroller, { scrollWidth: 768, scrollLeft: 168 });
    act(() => {
      fireEvent.scroll(scroller);
    });
    expect(
      Array.from(
        container.querySelectorAll<HTMLElement>('[data-edge-fade]'),
      ).map((fade) => fade.dataset.edgeFade),
    ).toEqual(['left']);
  });

  it('hands the content the font step for its measured width', () => {
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(1888);
    const seen: number[] = [];
    const { container } = render(
      <GridScroller>
        {(fontPx) => {
          seen.push(fontPx);
          return <div />;
        }}
      </GridScroller>,
    );
    // Unmeasured on the first render, then the 13 px step once the region reports 1888 px.
    expect(seen[0]).toBe(11);
    expect(seen.at(-1)).toBe(13);

    // The top fade starts past the hour axis, which grows with the stepped font.
    const scroller = container.querySelector('.overflow-auto');
    if (!(scroller instanceof HTMLElement)) {
      throw new Error('expected the scroller');
    }
    stubMetrics(scroller, { scrollHeight: 800, scrollTop: 40 });
    act(() => {
      fireEvent.scroll(scroller);
    });
    const top = container.querySelector<HTMLElement>('[data-edge-fade="top"]');
    expect(top?.style.top).toBe('19.2px');
  });
});
