import { describe, it, expect, afterEach, vi } from 'vitest';
import { useRef } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useFocusTrap } from './useFocusTrap';

afterEach(cleanup);

function Harness({
  active,
  onEscape,
}: {
  active: boolean;
  onEscape?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, active, onEscape);
  return (
    <div>
      <button data-testid="opener">opener</button>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="trap harness"
        tabIndex={-1}
        data-testid="panel"
      >
        <button data-testid="first">first</button>
        <button data-testid="last">last</button>
      </div>
    </div>
  );
}

describe('useFocusTrap', () => {
  it('moves focus into the panel when it activates', () => {
    render(<Harness active={true} />);
    expect(screen.getByTestId('panel')).toHaveFocus();
  });

  it('wraps Tab from the last focusable to the first', () => {
    render(<Harness active={true} />);
    screen.getByTestId('last').focus();
    fireEvent.keyDown(screen.getByTestId('panel'), { key: 'Tab' });
    expect(screen.getByTestId('first')).toHaveFocus();
  });

  it('wraps Shift+Tab from the first focusable to the last', () => {
    render(<Harness active={true} />);
    screen.getByTestId('first').focus();
    fireEvent.keyDown(screen.getByTestId('panel'), {
      key: 'Tab',
      shiftKey: true,
    });
    expect(screen.getByTestId('last')).toHaveFocus();
  });

  it('routes Escape to the close callback', () => {
    const onEscape = vi.fn();
    render(<Harness active={true} onEscape={onEscape} />);
    fireEvent.keyDown(screen.getByTestId('panel'), { key: 'Escape' });
    expect(onEscape).toHaveBeenCalledOnce();
  });

  it('restores focus to the opener when it deactivates', () => {
    const { rerender } = render(<Harness active={false} />);
    const opener = screen.getByTestId('opener');
    opener.focus();
    expect(opener).toHaveFocus();

    rerender(<Harness active={true} />);
    expect(screen.getByTestId('panel')).toHaveFocus();

    rerender(<Harness active={false} />);
    expect(opener).toHaveFocus();
  });
});
