import { describe, it, expect, afterEach, vi } from 'vitest';
import { useRef, type ReactNode } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useEscapeLayer } from './useEscapeLayer';

afterEach(cleanup);

function Layer({
  onEscape,
  active = true,
  children,
}: {
  onEscape: () => void;
  active?: boolean;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEscapeLayer(ref, onEscape, active);
  return (
    <div ref={ref} data-testid="layer">
      <button type="button">inside</button>
      {children}
    </div>
  );
}

// An outer layer listening natively on its own element, the way the overlay focus trap
// listens on the panel.
function Outer({
  onOuter,
  children,
}: {
  onOuter: (event: KeyboardEvent) => void;
  children: ReactNode;
}) {
  return (
    <div
      data-testid="outer"
      ref={(node) => {
        node?.addEventListener('keydown', onOuter);
      }}
    >
      {children}
    </div>
  );
}

describe('useEscapeLayer', () => {
  it('routes Escape inside the layer to its close callback', () => {
    const onEscape = vi.fn();
    render(<Layer onEscape={onEscape} />);
    fireEvent.keyDown(screen.getByRole('button', { name: 'inside' }), {
      key: 'Escape',
    });
    expect(onEscape).toHaveBeenCalledOnce();
  });

  it('ignores keys other than Escape', () => {
    const onEscape = vi.fn();
    render(<Layer onEscape={onEscape} />);
    fireEvent.keyDown(screen.getByTestId('layer'), { key: 'Enter' });
    expect(onEscape).not.toHaveBeenCalled();
  });

  it('keeps an outer native listener from seeing the press', () => {
    const onOuter = vi.fn();
    const onEscape = vi.fn();
    render(
      <Outer onOuter={onOuter}>
        <Layer onEscape={onEscape} />
      </Outer>,
    );
    const pressed = fireEvent.keyDown(screen.getByTestId('layer'), {
      key: 'Escape',
    });
    expect(onEscape).toHaveBeenCalledOnce();
    expect(onOuter).not.toHaveBeenCalled();
    // fireEvent returns false when the default was prevented.
    expect(pressed).toBe(false);
  });

  it('closes only the innermost of two nested layers', () => {
    const inner = vi.fn();
    const outer = vi.fn();
    render(
      <Layer onEscape={outer}>
        <Layer onEscape={inner} />
      </Layer>,
    );
    const [, innerLayer] = screen.getAllByTestId('layer');
    if (innerLayer === undefined) throw new Error('inner layer missing');
    fireEvent.keyDown(innerLayer, { key: 'Escape' });
    expect(inner).toHaveBeenCalledOnce();
    expect(outer).not.toHaveBeenCalled();
  });

  it('leaves a press a deeper handler already prevented', () => {
    const onEscape = vi.fn();
    render(<Layer onEscape={onEscape} />);
    const button = screen.getByRole('button', { name: 'inside' });
    button.addEventListener('keydown', (event) => {
      event.preventDefault();
    });
    fireEvent.keyDown(button, { key: 'Escape' });
    expect(onEscape).not.toHaveBeenCalled();
  });

  it('does nothing while inactive', () => {
    const onEscape = vi.fn();
    render(<Layer onEscape={onEscape} active={false} />);
    fireEvent.keyDown(screen.getByTestId('layer'), { key: 'Escape' });
    expect(onEscape).not.toHaveBeenCalled();
  });
});
