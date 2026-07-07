import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { useScrollLock } from './useScrollLock';

afterEach(() => {
  cleanup();
  document.documentElement.style.overflow = '';
});

function Harness({ active }: { active: boolean }) {
  useScrollLock(active);
  return null;
}

describe('useScrollLock', () => {
  it('does not touch overflow while inactive', () => {
    render(<Harness active={false} />);
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('locks and restores overflow around the active window', () => {
    const { rerender } = render(<Harness active={false} />);
    rerender(<Harness active={true} />);
    expect(document.documentElement.style.overflow).toBe('hidden');
    rerender(<Harness active={false} />);
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('restores overflow on unmount', () => {
    const { unmount } = render(<Harness active={true} />);
    expect(document.documentElement.style.overflow).toBe('hidden');
    unmount();
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('preserves a preexisting overflow value', () => {
    document.documentElement.style.overflow = 'scroll';
    const { rerender } = render(<Harness active={true} />);
    expect(document.documentElement.style.overflow).toBe('hidden');
    rerender(<Harness active={false} />);
    expect(document.documentElement.style.overflow).toBe('scroll');
  });
});
