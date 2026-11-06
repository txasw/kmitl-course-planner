import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  act,
  cleanup,
  fireEvent,
} from '@testing-library/react';
import { planStore, type UndoRecord } from '@/features/plans/planStore';
import {
  makePlanEntry,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import {
  resetPlanStore,
  seedActivePlan,
} from '../../../tests/support/plan-store';
import { TARGET_SIZE } from '@/lib/ui/target';
import { swipe } from '../../../tests/support/swipe';
import { Toaster } from './Toaster';
import { toastStore } from './toastStore';
import { uiStore } from './uiStore';

function removeRecord(): UndoRecord {
  const entry = makePlanEntry({
    snapshot: makeSnapshot({
      teachTableId: 'r1',
      subjectId: '90592033',
      subjectMeta: {
        subjectId: '90592033',
        nameTh: 'วิชาทดสอบ',
        nameEn: 'Test subject',
        credit: 3,
        creditStr: '3(3-0-6)',
      },
    }),
  });
  return { kind: 'remove', added: [], removed: [entry] };
}

afterEach(() => {
  cleanup();
  act(() => {
    toastStore.getState().dismiss();
    resetPlanStore();
    uiStore.getState().close();
    uiStore.getState().setLanguage('th');
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

  it('dismisses an ordinary toast from its close button', () => {
    render(<Toaster />);
    act(() => {
      toastStore.getState().show('success', 'Done');
    });
    expect(screen.getByText('Done')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ปิด' }));
    expect(screen.queryByText('Done')).toBeNull();
  });

  it('runs a toast action with its control and then dismisses the toast', () => {
    render(<Toaster />);
    const run = vi.fn();
    act(() => {
      toastStore.getState().show('success', 'Done', { label: 'View', run });
    });
    const action = screen.getByRole('button', { name: 'View' });
    fireEvent.click(action);
    expect(run).toHaveBeenCalledWith(action);
    expect(screen.queryByText('Done')).toBeNull();
  });

  it('renders no action control for a toast without one', () => {
    render(<Toaster />);
    act(() => {
      toastStore.getState().show('success', 'Done');
    });
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('holds a toast with an action while the pointer or focus is on it', () => {
    vi.useFakeTimers();
    try {
      render(<Toaster />);
      act(() => {
        toastStore
          .getState()
          .show('success', 'Done', { label: 'View', run: () => undefined });
      });
      const toast = screen.getByText('Done').parentElement;
      if (toast === null) throw new Error('toast missing');
      fireEvent.mouseEnter(toast);
      act(() => {
        vi.advanceTimersByTime(8000);
      });
      expect(screen.getByText('Done')).toBeInTheDocument();
      fireEvent.mouseLeave(toast);
      fireEvent.focus(screen.getByRole('button', { name: 'View' }));
      act(() => {
        vi.advanceTimersByTime(8000);
      });
      expect(screen.getByText('Done')).toBeInTheDocument();
      fireEvent.blur(screen.getByRole('button', { name: 'View' }));
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(screen.queryByText('Done')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not carry a hold over to the toast that replaces a held one', () => {
    vi.useFakeTimers();
    try {
      render(<Toaster />);
      act(() => {
        toastStore
          .getState()
          .show('success', 'First', { label: 'View', run: () => undefined });
      });
      const toast = screen.getByText('First').parentElement;
      if (toast === null) throw new Error('toast missing');
      fireEvent.mouseEnter(toast);
      act(() => {
        toastStore.getState().show('success', 'Second');
      });
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(screen.queryByText('Second')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('sizes the close button as a shared touch target', () => {
    render(<Toaster />);
    act(() => {
      toastStore.getState().show('success', 'Done');
    });
    const close = screen.getByRole('button', { name: 'ปิด' });
    for (const token of TARGET_SIZE.split(' ')) {
      expect(close).toHaveClass(token);
    }
  });

  it('dismisses an ordinary toast on a sideways swipe', () => {
    render(<Toaster />);
    act(() => {
      toastStore.getState().show('success', 'Done');
    });
    const toast = screen.getByText('Done').parentElement;
    if (toast === null) throw new Error('toast missing');
    expect(toast).toHaveClass('touch-pan-y');
    swipe(toast, 'x', -100);
    expect(screen.queryByText('Done')).toBeNull();
  });

  it('keeps an ordinary toast after a short or vertical swipe', () => {
    render(<Toaster />);
    act(() => {
      toastStore.getState().show('success', 'Done');
    });
    const toast = screen.getByText('Done').parentElement;
    if (toast === null) throw new Error('toast missing');
    swipe(toast, 'x', 20);
    swipe(toast, 'y', 100);
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(toast.style.transform).toBe('');
  });

  it('keeps a polite live region mounted and empty until a toast shows', () => {
    const { container } = render(<Toaster />);
    const region = container.querySelector('[aria-live="polite"]');
    expect(region).not.toBeNull();
    expect(region?.textContent).toBe('');
  });

  it('marks the live region with the active language', () => {
    const { container } = render(<Toaster />);
    const region = container.querySelector('[aria-live="polite"]');
    expect(region).toHaveAttribute('lang', 'th');
    act(() => {
      uiStore.getState().setLanguage('en');
    });
    expect(region).toHaveAttribute('lang', 'en');
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

  it('gives the undo toast priority so an ordinary toast does not displace it', () => {
    act(() => {
      uiStore.getState().open();
      seedActivePlan([]);
      planStore.setState({ pendingUndo: removeRecord() });
    });
    render(<Toaster />);
    expect(screen.getByText(/นำออกแล้ว 90592033/)).toBeInTheDocument();
    // An ordinary toast fired during the undo window queues behind it rather than
    // replacing it, so the undo toast still holds the region.
    act(() => {
      toastStore.getState().show('success', 'Copied');
    });
    expect(screen.getByText(/นำออกแล้ว 90592033/)).toBeInTheDocument();
    expect(screen.queryByText('Copied')).toBeNull();
  });

  it('shows the undo toast only while the panel is open', () => {
    act(() => {
      seedActivePlan([]);
      planStore.setState({ pendingUndo: removeRecord() });
    });
    render(<Toaster />);
    // Closed: no undo toast lingers over the bare host page.
    expect(screen.queryByText(/นำออกแล้ว/)).toBeNull();
    act(() => {
      uiStore.getState().open();
    });
    expect(screen.getByText(/นำออกแล้ว/)).toBeInTheDocument();
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
