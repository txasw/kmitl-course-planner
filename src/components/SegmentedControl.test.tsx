import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
} from '@testing-library/react';
import { Pencil } from 'lucide-react';
import { TARGET_SIZE } from '@/lib/ui/target';
import { SegmentedControl } from './SegmentedControl';

const options = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
] as const;

afterEach(cleanup);

describe('SegmentedControl', () => {
  it('marks the active option with aria-pressed', () => {
    render(
      <SegmentedControl
        ariaLabel="Choice"
        value="a"
        options={options}
        onChange={() => undefined}
      />,
    );
    expect(screen.getByRole('button', { name: 'Alpha' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Beta' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('reports the chosen value on click', () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        ariaLabel="Choice"
        value="a"
        options={options}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Beta' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });
});

describe('SegmentedControl variants', () => {
  it('fills the active option in the default filled variant', () => {
    render(
      <SegmentedControl
        ariaLabel="Choice"
        value="a"
        options={options}
        onChange={() => undefined}
      />,
    );
    const active = screen.getByRole('button', { name: 'Alpha' });
    expect(active).toHaveClass('bg-primary-strong', 'text-white');
    expect(screen.getByRole('button', { name: 'Beta' })).not.toHaveClass(
      'bg-primary-strong',
    );
  });

  it('marks the active option with surface, ink, and weight in the quiet variant', () => {
    render(
      <SegmentedControl
        ariaLabel="Choice"
        value="b"
        options={options}
        onChange={() => undefined}
        variant="quiet"
      />,
    );
    const active = screen.getByRole('button', { name: 'Beta' });
    expect(active).toHaveClass('bg-surface-alt', 'font-semibold', 'text-ink');
    expect(active).not.toHaveClass('bg-primary-strong');
    expect(screen.getByRole('button', { name: 'Alpha' })).toHaveClass(
      'text-ink-soft',
    );
  });

  it('shows an icon option as a square icon below 640 px and keeps its label as the name', () => {
    render(
      <SegmentedControl
        ariaLabel="Choice"
        value="a"
        options={[
          { value: 'a', label: 'Alpha', icon: Pencil },
          { value: 'b', label: 'Beta' },
        ]}
        onChange={() => undefined}
      />,
    );
    const withIcon = screen.getByRole('button', { name: 'Alpha' });
    expect(withIcon).toHaveClass('max-sm:size-8');
    expect(withIcon.querySelector('svg')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(within(withIcon).getByText('Alpha')).toHaveClass('max-sm:sr-only');
    const plain = screen.getByRole('button', { name: 'Beta' });
    expect(plain).not.toHaveClass('max-sm:size-8');
    expect(plain.querySelector('svg')).toBeNull();
  });

  it('keeps every label on one line at the shared target size', () => {
    render(
      <SegmentedControl
        ariaLabel="Choice"
        value="a"
        options={options}
        onChange={() => undefined}
      />,
    );
    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveClass('whitespace-nowrap');
      for (const token of TARGET_SIZE.split(' ')) {
        expect(button).toHaveClass(token);
      }
    }
  });
});
