import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Check } from 'lucide-react';
import { Pill } from './Pill';

afterEach(cleanup);

describe('Pill', () => {
  it('renders a plain pill with its label', () => {
    render(<Pill tone="success">Added</Pill>);
    expect(screen.getByText('Added')).toBeInTheDocument();
  });

  it('keeps the label visible beside its icon at any container width', () => {
    const { container } = render(
      <div style={{ width: '14rem' }}>
        <Pill tone="success" icon={<Check size={12} aria-hidden />}>
          Added
        </Pill>
      </div>,
    );
    const pill = screen.getByText('Added');
    expect(pill).toBeVisible();
    // No container query collapse and no visually hidden label anywhere in the pill.
    expect(
      container.querySelectorAll('[class*="@max-"], .sr-only'),
    ).toHaveLength(0);
  });

  it('carries no tooltip, so the label is never hover only', () => {
    render(
      <Pill tone="success" icon={<Check size={12} aria-hidden />}>
        Added
      </Pill>,
    );
    fireEvent.mouseEnter(screen.getByText('Added'));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('uses the inner radius token so it reads tighter than its card', () => {
    render(<Pill tone="danger">Full</Pill>);
    expect(screen.getByText('Full')).toHaveClass('rounded-kcp-inner');
  });
});
