import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { Toaster } from './Toaster';
import { toastStore } from './toastStore';

afterEach(() => {
  cleanup();
  act(() => {
    toastStore.getState().dismiss();
  });
});

describe('Toaster', () => {
  it('renders a shown toast and auto dismisses it', () => {
    vi.useFakeTimers();
    try {
      render(<Toaster />);
      act(() => {
        toastStore.getState().show('success', 'Done');
      });
      expect(screen.getByRole('status')).toHaveTextContent('Done');
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(screen.queryByRole('status')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps a polite live region mounted even when empty', () => {
    const { container } = render(<Toaster />);
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('applies the error variant styling', () => {
    render(<Toaster />);
    act(() => {
      toastStore.getState().show('error', 'Failed');
    });
    expect(screen.getByRole('status').className).toContain('bg-danger-soft');
  });
});
