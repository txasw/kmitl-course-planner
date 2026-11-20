import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { CountChip } from './CountChip';

afterEach(cleanup);

describe('CountChip', () => {
  it('draws the one count badge: ink filled with white figures and a surface ring', () => {
    const { container } = render(<CountChip count={154} />);
    const badge = container.querySelector('[data-count-badge]');
    expect(badge).toHaveTextContent('154');
    const tokens = badge?.className.split(' ') ?? [];
    expect(tokens).toEqual(
      expect.arrayContaining([
        'rounded-full',
        'bg-ink',
        'text-surface',
        'ring-2',
        'ring-surface',
        'tabular-nums',
      ]),
    );
    // Neither the orange fill nor the white bordered pill of the earlier badges.
    expect(tokens).not.toContain('bg-primary-strong');
    expect(tokens).not.toContain('border');
  });

  it('stays out of the accessibility tree, since the control name carries the count', () => {
    const { container } = render(<CountChip count={2} />);
    expect(container.querySelector('[data-count-badge]')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });
});
