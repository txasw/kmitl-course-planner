import { describe, it, expect, afterEach, vi } from 'vitest';
import { useRef } from 'react';
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
import { installViewport } from '../../../tests/support/viewport';
import { useBottomSheetPresence } from './sheetToastBand';
import { useToastFoot } from './toastFloor';
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
  vi.unstubAllGlobals();
  act(() => {
    toastStore.getState().dismiss();
    resetPlanStore();
    uiStore.getState().close();
    uiStore.getState().setLanguage('th');
    uiStore.getState().setViewMode('edit');
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

  it('keeps its edge offsets or the device safe area insets, whichever is larger', () => {
    installViewport(1366);
    act(() => {
      uiStore.getState().open();
    });
    const { container } = render(<Toaster />);
    expect(container.querySelector('[aria-live="polite"]')).toHaveClass(
      'bottom-[max(16px,var(--kcp-safe-bottom))]',
      'pr-[max(16px,var(--kcp-safe-right))]',
      'pl-[max(16px,var(--kcp-safe-left))]',
    );
  });

  it('rises above the phone bottom nav while the panel is open', () => {
    const viewport = installViewport(390);
    const { container } = render(<Toaster />);
    const region = container.querySelector('[aria-live="polite"]');
    const ABOVE_FOOT = 'bottom-[calc(72px+var(--kcp-safe-bottom))]';
    const AT_FOOT = 'bottom-[max(16px,var(--kcp-safe-bottom))]';
    // Over the bare host page there are no controls to clear.
    expect(region).toHaveClass(AT_FOOT);
    act(() => {
      uiStore.getState().open();
    });
    // Edit runs the bottom nav along the foot.
    expect(region).toHaveClass(ABOVE_FOOT);
    expect(region).not.toHaveClass(AT_FOOT);
    // The export page has no nav; the region floats above its sharing toolbar once the
    // plan region names it as the foot.
    act(() => {
      uiStore.getState().setViewMode('preview');
    });
    expect(region).toHaveClass(AT_FOOT);
    // From 640 px up there is no nav in edit either.
    act(() => {
      uiStore.getState().setViewMode('edit');
      viewport.resize(768);
    });
    expect(region).toHaveClass(AT_FOOT);
  });

  it('floats above the foot the plan region names, measured by the foot alone', () => {
    const viewport = installViewport(1366);
    act(() => {
      uiStore.getState().open();
    });
    function Foot({ height }: { height: number }) {
      const ref = useRef<HTMLDivElement>(null);
      useToastFoot(ref, 'status');
      return <div ref={ref} style={{ height }} />;
    }
    const spy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue(new DOMRect(0, 0, 100, 40));
    try {
      const { container, rerender } = render(
        <>
          <Toaster />
          <Foot height={40} />
        </>,
      );
      const region = container.querySelector<HTMLElement>(
        '[aria-live="polite"]',
      );
      // The panel padding, the 40 px status row, and the gap, above the safe area inset.
      expect(region?.style.bottom).toBe('calc(64px + var(--kcp-safe-bottom))');
      expect(region).not.toHaveClass(
        'bottom-[max(16px,var(--kcp-safe-bottom))]',
      );
      // A toast that shows changes nothing the offset reads.
      act(() => {
        toastStore.getState().show('success', 'Done');
      });
      expect(region?.style.bottom).toBe('calc(64px + var(--kcp-safe-bottom))');
      // On the phone the bottom nav runs under the status row, so the offset clears both.
      act(() => {
        viewport.resize(390);
      });
      expect(region?.style.bottom).toBe('calc(120px + var(--kcp-safe-bottom))');
      // With no foot named the region rests above the nav again.
      rerender(<Toaster />);
      expect(region?.style.bottom).toBe('');
      expect(region).toHaveClass('bottom-[calc(72px+var(--kcp-safe-bottom))]');
    } finally {
      spy.mockRestore();
    }
  });

  it('drops to the foot while a bottom sheet covers the phone foot controls', () => {
    installViewport(390);
    act(() => {
      uiStore.getState().open();
    });
    function OpenSheet() {
      useBottomSheetPresence();
      return null;
    }
    const { container, rerender } = render(<Toaster />);
    const region = container.querySelector('[aria-live="polite"]');
    expect(region).toHaveClass('bottom-[calc(72px+var(--kcp-safe-bottom))]');
    // The sheet covers the bottom nav and ends in the band the toast sits in, so the
    // region sits at the foot rather than over the sheet's content.
    rerender(
      <>
        <Toaster />
        <OpenSheet />
      </>,
    );
    expect(region).toHaveClass('bottom-[max(16px,var(--kcp-safe-bottom))]');
    rerender(<Toaster />);
    expect(region).toHaveClass('bottom-[calc(72px+var(--kcp-safe-bottom))]');
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
