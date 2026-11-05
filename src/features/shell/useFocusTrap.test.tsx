import { describe, it, expect, afterEach, vi } from 'vitest';
import { useRef } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useFocusTrap } from './useFocusTrap';

afterEach(cleanup);

function Harness({
  active,
  onEscape,
  inertTail = false,
}: {
  active: boolean;
  onEscape?: () => void;
  inertTail?: boolean;
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
        {inertTail ? (
          <div inert>
            <button data-testid="inert">inert</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// A modal layer with its own trap inside the trapped overlay, the shape of a sheet
// opened from the panel.
function NestedHarness({
  onOuterEscape,
  onInnerEscape,
}: {
  onOuterEscape: () => void;
  onInnerEscape: () => void;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(outerRef, true, onOuterEscape);
  useFocusTrap(innerRef, true, onInnerEscape);
  return (
    <div ref={outerRef} tabIndex={-1}>
      <button type="button">outer</button>
      <div ref={innerRef} tabIndex={-1}>
        <button type="button" data-testid="inner-button">
          inner
        </button>
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

  it('wraps past an inert subtree that ends the panel', () => {
    render(<Harness active={true} inertTail={true} />);
    screen.getByTestId('last').focus();
    fireEvent.keyDown(screen.getByTestId('panel'), { key: 'Tab' });
    expect(screen.getByTestId('first')).toHaveFocus();
  });

  it('routes Escape to the close callback', () => {
    const onEscape = vi.fn();
    render(<Harness active={true} onEscape={onEscape} />);
    fireEvent.keyDown(screen.getByTestId('panel'), { key: 'Escape' });
    expect(onEscape).toHaveBeenCalledOnce();
  });

  it('ignores an Escape a nested layer already handled', () => {
    const onEscape = vi.fn();
    render(<Harness active={true} onEscape={onEscape} />);
    const first = screen.getByTestId('first');
    first.addEventListener('keydown', (event) => {
      event.preventDefault();
    });
    fireEvent.keyDown(first, { key: 'Escape' });
    expect(onEscape).not.toHaveBeenCalled();
  });

  it('keeps the overlay open when a nested trap closes on Escape', () => {
    const outer = vi.fn();
    const inner = vi.fn();
    render(<NestedHarness onOuterEscape={outer} onInnerEscape={inner} />);
    fireEvent.keyDown(screen.getByTestId('inner-button'), { key: 'Escape' });
    expect(inner).toHaveBeenCalledOnce();
    expect(outer).not.toHaveBeenCalled();
  });

  it('leaves Escape unhandled when it has no close callback', () => {
    render(<Harness active={true} />);
    const pressed = fireEvent.keyDown(screen.getByTestId('panel'), {
      key: 'Escape',
    });
    // fireEvent returns true when nothing prevented the default.
    expect(pressed).toBe(true);
  });

  it('wraps Shift+Tab from the panel itself to the last stop', () => {
    render(<Harness active={true} />);
    const panel = screen.getByTestId('panel');
    expect(panel).toHaveFocus();
    fireEvent.keyDown(panel, { key: 'Tab', shiftKey: true });
    expect(screen.getByTestId('last')).toHaveFocus();
  });

  it('leaves a Tab that a nested trap already wrapped', () => {
    render(<NestedHarness onOuterEscape={vi.fn()} onInnerEscape={vi.fn()} />);
    const inner = screen.getByTestId('inner-button');
    inner.focus();
    fireEvent.keyDown(inner, { key: 'Tab' });
    expect(inner).toHaveFocus();
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
