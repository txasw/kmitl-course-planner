import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Disclosure } from './Disclosure';

afterEach(() => {
  cleanup();
});

describe('Disclosure', () => {
  it('starts collapsed behind a chevron button and expands on press', () => {
    render(
      <Disclosure label="Subjects in this option: 2">
        <p>Panel text</p>
      </Disclosure>,
    );
    const toggle = screen.getByRole('button', {
      name: 'Subjects in this option: 2',
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).not.toHaveAttribute('aria-controls');
    expect(toggle.querySelector('svg')).toHaveClass(
      'lucide-chevron-down',
      '-rotate-90',
    );
    expect(screen.queryByText('Panel text')).toBeNull();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle.querySelector('svg')).not.toHaveClass('-rotate-90');
    const panel = screen.getByText('Panel text').parentElement;
    expect(toggle).toHaveAttribute('aria-controls', panel?.id);

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Panel text')).toBeNull();
  });

  it('renders no native details element or browser marker', () => {
    render(
      <Disclosure label="Toggle">
        <p>Panel</p>
      </Disclosure>,
    );
    expect(document.querySelector('details, summary')).toBeNull();
  });
});
