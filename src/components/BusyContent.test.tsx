import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Copy } from 'lucide-react';
import { BusyContent } from './BusyContent';

afterEach(cleanup);

function renderButton(busy: boolean) {
  render(
    <button type="button">
      <BusyContent
        icon={Copy}
        size={16}
        label="Copy as text"
        busyLabel="Copying"
        busy={busy}
      />
    </button>,
  );
  return screen.getByRole('button');
}

describe('BusyContent', () => {
  it('shows the idle glyph and names the action while idle', () => {
    const button = renderButton(false);
    expect(button).toHaveAccessibleName('Copy as text');
    expect(button.querySelector('svg')).toHaveClass('lucide-copy');
    expect(screen.getByText('Copying')).toHaveClass('invisible');
  });

  it('swaps to a spinner and the busy label, still under reduced motion', () => {
    const button = renderButton(true);
    expect(button).toHaveAccessibleName('Copying');
    const spinner = button.querySelector('svg');
    expect(spinner).toHaveClass('lucide-loader-circle', 'animate-spin');
    expect(spinner).toHaveClass('motion-reduce:animate-none');
    expect(screen.getByText('Copy as text')).toHaveClass('invisible');
  });

  it('stacks both labels in one cell, so the control keeps the wider width', () => {
    renderButton(false);
    for (const text of ['Copy as text', 'Copying']) {
      expect(screen.getByText(text)).toHaveClass('col-start-1', 'row-start-1');
    }
  });
});
