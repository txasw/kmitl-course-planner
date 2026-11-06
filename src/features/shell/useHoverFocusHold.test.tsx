import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useHoverFocusHold } from './useHoverFocusHold';

function Notice({ noticeKey }: { noticeKey: string | number | null }) {
  const { held, handlers } = useHoverFocusHold(noticeKey);
  return (
    <div data-testid="notice" data-held={String(held)} {...handlers}>
      <button type="button">Act</button>
    </div>
  );
}

function notice() {
  return screen.getByTestId('notice');
}

afterEach(() => {
  cleanup();
});

describe('useHoverFocusHold', () => {
  it('starts released', () => {
    render(<Notice noticeKey={1} />);
    expect(notice().dataset.held).toBe('false');
  });

  it('holds after mouseenter and releases after mouseleave', () => {
    render(<Notice noticeKey={1} />);
    fireEvent.mouseEnter(notice());
    expect(notice().dataset.held).toBe('true');
    fireEvent.mouseLeave(notice());
    expect(notice().dataset.held).toBe('false');
  });

  it('holds while focus is within and releases after blur out', () => {
    render(<Notice noticeKey={1} />);
    const button = screen.getByRole('button', { name: 'Act' });
    fireEvent.focus(button);
    expect(notice().dataset.held).toBe('true');
    fireEvent.blur(button);
    expect(notice().dataset.held).toBe('false');
  });

  it('starts a new key released even when the previous key was held', () => {
    const { rerender } = render(<Notice noticeKey={1} />);
    fireEvent.mouseEnter(notice());
    expect(notice().dataset.held).toBe('true');
    rerender(<Notice noticeKey={2} />);
    expect(notice().dataset.held).toBe('false');
  });

  it('never holds without a key', () => {
    render(<Notice noticeKey={null} />);
    fireEvent.mouseEnter(notice());
    expect(notice().dataset.held).toBe('false');
  });
});
