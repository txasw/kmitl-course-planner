import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { BrandMark } from './BrandMark';

afterEach(cleanup);

describe('BrandMark', () => {
  it('derives from the icon geometry: a rounded tile with the squares knocked out and a faded accent', () => {
    const { container } = render(<BrandMark />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();

    // The rounded container tile, painted in currentColor and masked so the squares cut out as
    // negative space rather than reading as four detached filled squares.
    const tile = svg?.querySelector('rect[rx="28"]');
    expect(tile).not.toBeNull();
    expect(tile?.getAttribute('fill')).toBe('currentColor');
    expect(tile?.getAttribute('mask')).toMatch(/^url\(#kcp-brand-/);

    // The mask carries the four icon squares as knockouts at the source coordinates, 38 wide.
    const mask = svg?.querySelector('mask');
    expect(mask).not.toBeNull();
    const knockouts = Array.from(
      mask?.querySelectorAll('rect[fill="black"]') ?? [],
    );
    const coords = knockouts
      .map(
        (rect) =>
          `${rect.getAttribute('x') ?? ''},${rect.getAttribute('y') ?? ''}`,
      )
      .sort();
    expect(coords).toEqual(['22,22', '22,68', '68,22', '68,68']);
    for (const rect of knockouts) {
      expect(rect.getAttribute('width')).toBe('38');
      expect(rect.getAttribute('height')).toBe('38');
    }

    // The signature accent square keeps its bottom right position at reduced opacity, in
    // currentColor, so it survives in one colour rather than becoming a full filled square.
    const accent = svg?.querySelector('rect[opacity="0.45"]');
    expect(accent).not.toBeNull();
    expect(accent?.getAttribute('x')).toBe('68');
    expect(accent?.getAttribute('y')).toBe('68');
    expect(accent?.getAttribute('fill')).toBe('currentColor');
  });

  it('gives each instance a unique mask id so marks on one poster do not collide', () => {
    const { container } = render(
      <>
        <BrandMark />
        <BrandMark />
      </>,
    );
    const ids = Array.from(container.querySelectorAll('mask')).map(
      (mask) => mask.id,
    );
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });
});
