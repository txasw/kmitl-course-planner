import { describe, it, expect, afterEach, vi } from 'vitest';
import { useRef } from 'react';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import { planStore, type UndoRecord } from '@/features/plans/planStore';
import {
  makePlan,
  makePlanEntry,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import {
  resetPlanStore,
  seedActivePlan,
} from '../../../tests/support/plan-store';
import { swipe } from '../../../tests/support/swipe';
import { UndoToast } from './UndoToast';
import { useFocusTrap } from './useFocusTrap';

const t = createTranslator('th');

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

function coalescedRecord(count: number): UndoRecord {
  const removed = Array.from({ length: count }, (_unused, index) =>
    makePlanEntry({
      snapshot: makeSnapshot({
        teachTableId: `r${String(index)}`,
        subjectId: `9059200${String(index)}`,
      }),
    }),
  );
  return { kind: 'remove', added: [], removed };
}

// The toast reads its record from props but drives undo through the store, so the store
// carries the same pending undo and an active plan for undo to reverse into.
function seedUndo(record: UndoRecord): void {
  act(() => {
    seedActivePlan([]);
    planStore.setState({ pendingUndo: record });
  });
}

// The app renders the toaster beside the overlay panel, not inside it, so the trapped
// panel here is a sibling of the toast with its own close callback.
function OverlayBesideToast({
  record,
  onEscape,
}: {
  record: UndoRecord;
  onEscape: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, true, onEscape);
  return (
    <div>
      <div ref={ref} role="dialog" aria-label="panel" tabIndex={-1} />
      <UndoToast record={record} locale="th" t={t} />
    </div>
  );
}

afterEach(() => {
  cleanup();
  act(() => {
    resetPlanStore();
  });
});

describe('UndoToast', () => {
  it('names the removed subject with the undo action', () => {
    const record = removeRecord();
    seedUndo(record);
    render(<UndoToast record={record} locale="th" t={t} />);
    expect(screen.getByText(/นำออกแล้ว 90592033/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'เลิกทำ' })).toBeInTheDocument();
  });

  it('names a created plan and deletes it on undo', () => {
    act(() => {
      seedActivePlan([], { id: 'before', name: 'ตาราง 1/2569' });
      planStore.setState((state) => ({
        plans: [
          ...state.plans,
          makePlan({ id: 'created', name: 'ตาราง 1/2569 เน้นเช้า' }),
        ],
        activePlanId: 'created',
      }));
    });
    const record: UndoRecord = {
      kind: 'create',
      planId: 'created',
      planName: 'ตาราง 1/2569 เน้นเช้า',
      previousPlanId: 'before',
    };
    act(() => {
      planStore.setState({ pendingUndo: record });
    });
    render(<UndoToast record={record} locale="th" t={t} />);
    expect(
      screen.getByText('สร้างตาราง ตาราง 1/2569 เน้นเช้า แล้ว'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'เลิกทำ' }));
    expect(planStore.getState().plans.map((plan) => plan.id)).toEqual([
      'before',
    ]);
    expect(planStore.getState().activePlanId).toBe('before');
  });

  it('names a count when several removals coalesce', () => {
    const record = coalescedRecord(2);
    seedUndo(record);
    render(<UndoToast record={record} locale="th" t={t} />);
    expect(screen.getByText('นำออกแล้ว 2 รายการ')).toBeInTheDocument();
  });

  it('commits the change when the close button is pressed', () => {
    const record = removeRecord();
    seedUndo(record);
    render(<UndoToast record={record} locale="th" t={t} />);
    fireEvent.click(screen.getByRole('button', { name: 'ปิด' }));
    // The pending undo cleared, so the removal stands and was not restored.
    expect(planStore.getState().pendingUndo).toBeNull();
    expect(planStore.getState().entries).toHaveLength(0);
  });

  it('commits the change on a sideways swipe', () => {
    const record = removeRecord();
    seedUndo(record);
    render(<UndoToast record={record} locale="th" t={t} />);
    const toast = screen.getByText(/นำออกแล้ว 90592033/).parentElement;
    if (toast === null) throw new Error('toast missing');
    swipe(toast, 'x', 100);
    expect(planStore.getState().pendingUndo).toBeNull();
  });

  it('keeps the undo window open after a vertical swipe', () => {
    const record = removeRecord();
    seedUndo(record);
    render(<UndoToast record={record} locale="th" t={t} />);
    const toast = screen.getByText(/นำออกแล้ว 90592033/).parentElement;
    if (toast === null) throw new Error('toast missing');
    swipe(toast, 'y', 100);
    expect(planStore.getState().pendingUndo).toBe(record);
  });

  it('restores the removed pair on undo', () => {
    const record = removeRecord();
    seedUndo(record);
    render(<UndoToast record={record} locale="th" t={t} />);
    fireEvent.click(screen.getByRole('button', { name: 'เลิกทำ' }));
    expect(planStore.getState().entries).toHaveLength(1);
    expect(planStore.getState().pendingUndo).toBeNull();
  });

  it('commits the change when the window expires', () => {
    vi.useFakeTimers();
    try {
      const record = removeRecord();
      seedUndo(record);
      render(<UndoToast record={record} locale="th" t={t} />);
      act(() => {
        vi.advanceTimersByTime(10_000);
      });
      // The pending undo cleared, so the removal stands and was not restored.
      expect(planStore.getState().pendingUndo).toBeNull();
      expect(planStore.getState().entries).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('dismisses on Escape and keeps the overlay open', () => {
    const record = removeRecord();
    seedUndo(record);
    const onEscape = vi.fn();
    render(<OverlayBesideToast record={record} onEscape={onEscape} />);
    const close = screen.getByRole('button', { name: 'ปิด' });
    close.focus();
    fireEvent.keyDown(close, { key: 'Escape' });
    // The pending undo cleared, so the toast dismissed and the removal stands.
    expect(planStore.getState().pendingUndo).toBeNull();
    expect(onEscape).not.toHaveBeenCalled();
  });

  it('pauses the window while hovered and resumes on leave', () => {
    vi.useFakeTimers();
    try {
      const record = removeRecord();
      seedUndo(record);
      const { container } = render(
        <UndoToast record={record} locale="th" t={t} />,
      );
      const toast = container.firstElementChild;
      expect(toast).not.toBeNull();
      if (toast === null) {
        return;
      }
      fireEvent.mouseEnter(toast);
      act(() => {
        vi.advanceTimersByTime(10_000);
      });
      // The hover paused the window, so the change has not committed.
      expect(planStore.getState().pendingUndo).not.toBeNull();
      fireEvent.mouseLeave(toast);
      act(() => {
        vi.advanceTimersByTime(10_000);
      });
      expect(planStore.getState().pendingUndo).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
