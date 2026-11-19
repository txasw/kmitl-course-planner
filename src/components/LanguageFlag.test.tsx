import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { LanguageFlag } from './LanguageFlag';

describe('LanguageFlag', () => {
  it('draws the Thai flag as five bands in its three colours', () => {
    const { container } = render(<LanguageFlag locale="th" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('viewBox', '0 0 9 6');
    const fills = Array.from(svg?.querySelectorAll('rect') ?? []).map((rect) =>
      rect.getAttribute('fill'),
    );
    expect(fills).toEqual(['#A51931', '#F4F5F8', '#2D2A4A']);
  });

  it('draws the United States flag with 13 stripes and 50 stars for English', () => {
    const { container } = render(<LanguageFlag locale="en" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    // The field, seven red stripes over it, and the canton.
    expect(svg?.querySelectorAll('rect')).toHaveLength(9);
    expect(svg?.querySelectorAll('circle')).toHaveLength(50);
    // The field anchors at its left edge, so the canton is never cropped.
    expect(svg).toHaveAttribute('preserveAspectRatio', 'xMinYMid slice');
  });

  it('fills the same box for either language', () => {
    const th = render(<LanguageFlag locale="th" />).container.querySelector(
      'svg',
    );
    const en = render(<LanguageFlag locale="en" />).container.querySelector(
      'svg',
    );
    expect(th?.getAttribute('class')).toBe(en?.getAttribute('class'));
  });
});
