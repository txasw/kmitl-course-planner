import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Launcher } from './Launcher';

afterEach(cleanup);

describe('Launcher', () => {
  it('renders an accessible launcher button', () => {
    render(<Launcher />);
    const button = screen.getByRole('button', {
      name: 'Open KMITL Course Planner',
    });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('Planner');
  });
});
