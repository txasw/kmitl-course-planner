import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { Toaster } from './Toaster';
import { toastStore } from './toastStore';
import { uiStore } from './uiStore';

afterEach(() => {
  cleanup();
  act(() => {
    toastStore.getState().dismiss();
    uiStore.getState().close();
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
      expect(screen.getByText('Done')).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(screen.queryByText('Done')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps a polite live region mounted and empty until a toast shows', () => {
    const { container } = render(<Toaster />);
    const region = container.querySelector('[aria-live="polite"]');
    expect(region).not.toBeNull();
    expect(region?.textContent).toBe('');
  });

  it('is the sole live region, without a nested one', () => {
    render(<Toaster />);
    act(() => {
      toastStore.getState().show('success', 'Done');
    });
    // No inner role=status live region nested in the outer aria-live region.
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('applies the error variant styling', () => {
    render(<Toaster />);
    act(() => {
      toastStore.getState().show('error', 'Failed');
    });
    expect(screen.getByText('Failed').parentElement?.className).toContain(
      'bg-danger-soft',
    );
  });

  it('dismisses a panel toast when the overlay closes', () => {
    act(() => {
      uiStore.getState().open();
    });
    render(<Toaster />);
    act(() => {
      toastStore.getState().show('success', 'Done');
    });
    expect(screen.getByText('Done')).toBeInTheDocument();
    act(() => {
      uiStore.getState().close();
    });
    expect(screen.queryByText('Done')).toBeNull();
  });
});
