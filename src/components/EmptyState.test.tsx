import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Search } from 'lucide-react';
import { EmptyState } from './EmptyState';

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

  it('omits the action when none is given', () => {
    render(
      <EmptyState icon={Search} title="No data" description="Try a search." />,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
