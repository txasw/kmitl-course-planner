import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Search } from 'lucide-react';
import { EmptyState, EmptyStateAction } from './EmptyState';

afterEach(cleanup);

describe('EmptyState', () => {
  it('renders the title and description', () => {
    render(
      <EmptyState icon={Search} title="No data" description="Try a search." />,
    );
    expect(
      screen.getByRole('heading', { name: 'No data' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Try a search.')).toBeInTheDocument();
  });

  it('renders an action when one is given', () => {
    render(
      <EmptyState
        icon={Search}
        title="No data"
        description="Try a search."
        action={<button type="button">Retry</button>}
      />,
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('fills its region with no surface of its own and a neutral icon disc', () => {
    const { container } = render(
      <EmptyState icon={Search} title="No data" description="Try a search." />,
    );
    const root = container.querySelector('[data-empty-state]');
    expect(root).toHaveClass('h-full');
    expect(root).not.toHaveClass('border', 'bg-surface', 'shadow-kcp');
    expect(root?.querySelector('span')).toHaveClass(
      'bg-surface-alt',
      'text-ink-soft',
    );
  });

  it('omits the action when none is given', () => {
    render(
      <EmptyState icon={Search} title="No data" description="Try a search." />,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('EmptyStateAction', () => {
  it('is a primary button at the target size that runs its handler', () => {
    let pressed = 0;
    render(
      <EmptyStateAction
        label="Go to search"
        onClick={() => {
          pressed += 1;
        }}
      />,
    );
    const button = screen.getByRole('button', { name: 'Go to search' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveClass('bg-primary-strong', 'pointer-events-auto');
    expect(button.className).toContain('min-w-(--kcp-target-min)');
    fireEvent.click(button);
    expect(pressed).toBe(1);
  });
});
