import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
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
