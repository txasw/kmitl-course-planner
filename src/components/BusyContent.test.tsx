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

  it('lays the busy label over the idle label, which alone takes room', () => {
    renderButton(false);
    // The busy label sits out of flow on one line, so the control at rest is the control
    // without it; the e2e export spec measures that the boxes match.
    expect(screen.getByText('Copying')).toHaveClass(
      'absolute',
      'inset-x-0',
      'truncate',
    );
    expect(screen.getByText('Copy as text')).not.toHaveClass('absolute');
  });
});
