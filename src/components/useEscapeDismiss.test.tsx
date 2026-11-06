import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { useEscapeDismiss } from './useEscapeDismiss';

afterEach(cleanup);

function Probe({
  active,
  onDismiss,
}: {
  active: boolean;
  onDismiss: () => void;
}) {
  useEscapeDismiss(active, onDismiss);
  return <button type="button">Inside</button>;
}

// Model the overlay focus trap, which listens on an ancestor in the bubble phase.
function withAncestor(run: (button: HTMLElement) => void): () => void {
  const onAncestorEscape = vi.fn();
  const handler = (event: KeyboardEvent) => {
    if (event.key === 'Escape') onAncestorEscape();
  };
  document.body.addEventListener('keydown', handler);
  try {
    const button = document.querySelector<HTMLElement>('button');
    if (button === null) throw new Error('expected the probe button');
    run(button);
  } finally {
    document.body.removeEventListener('keydown', handler);
  }
  return onAncestorEscape;
}

describe('useEscapeDismiss', () => {
  it('dismisses on Escape and keeps the press from the ancestor', () => {
    const onDismiss = vi.fn();
    render(<Probe active onDismiss={onDismiss} />);
    const onAncestorEscape = withAncestor((button) => {
      fireEvent.keyDown(button, { key: 'Escape' });
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onAncestorEscape).not.toHaveBeenCalled();
  });

  it('leaves Escape alone while inactive', () => {
    const onDismiss = vi.fn();
    render(<Probe active={false} onDismiss={onDismiss} />);
    const onAncestorEscape = withAncestor((button) => {
      fireEvent.keyDown(button, { key: 'Escape' });
    });
    expect(onDismiss).not.toHaveBeenCalled();
    expect(onAncestorEscape).toHaveBeenCalledTimes(1);
  });

  it('ignores other keys', () => {
    const onDismiss = vi.fn();
    render(<Probe active onDismiss={onDismiss} />);
    const onAncestorEscape = withAncestor((button) => {
      fireEvent.keyDown(button, { key: 'Enter' });
    });
    expect(onDismiss).not.toHaveBeenCalled();
    expect(onAncestorEscape).not.toHaveBeenCalled();
  });

  it('calls the latest callback after a rerender', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<Probe active onDismiss={first} />);
    rerender(<Probe active onDismiss={second} />);
    withAncestor((button) => {
      fireEvent.keyDown(button, { key: 'Escape' });
    });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('detaches on unmount', () => {
    const onDismiss = vi.fn();
    const { unmount } = render(<Probe active onDismiss={onDismiss} />);
    unmount();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
