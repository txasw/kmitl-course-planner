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

describe('useScrollLock with stacked layers', () => {
  function Pair({ first, second }: { first: boolean; second: boolean }) {
    return (
      <>
        <Harness active={first} />
        <Harness active={second} />
      </>
    );
  }

  it('restores the original overflow only after both release, first one first', () => {
    document.documentElement.style.overflow = 'auto';
    const { rerender } = render(<Pair first={true} second={false} />);
    rerender(<Pair first={true} second={true} />);
    rerender(<Pair first={false} second={true} />);
    expect(document.documentElement.style.overflow).toBe('hidden');
    rerender(<Pair first={false} second={false} />);
    expect(document.documentElement.style.overflow).toBe('auto');
  });

  it('restores the original overflow only after both release, last one first', () => {
    document.documentElement.style.overflow = 'auto';
    const { rerender } = render(<Pair first={true} second={false} />);
    rerender(<Pair first={true} second={true} />);
    rerender(<Pair first={true} second={false} />);
    expect(document.documentElement.style.overflow).toBe('hidden');
    rerender(<Pair first={false} second={false} />);
    expect(document.documentElement.style.overflow).toBe('auto');
  });

  it('keeps the host locked when one layer hands over to another in one commit', () => {
    const { rerender } = render(<Pair first={true} second={false} />);
    rerender(<Pair first={false} second={true} />);
    expect(document.documentElement.style.overflow).toBe('hidden');
    rerender(<Pair first={false} second={false} />);
    expect(document.documentElement.style.overflow).toBe('');
  });
});
