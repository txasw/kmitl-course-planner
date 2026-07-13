import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { planStore, type UndoRecord } from '@/features/plans/planStore';
import {
  makePlanEntry,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import {
  resetPlanStore,
  seedActivePlan,
} from '../../../tests/support/plan-store';
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
