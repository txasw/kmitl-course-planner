import { describe, it, expect, afterEach, vi } from 'vitest';
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
  makePlanEntry,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import {
  resetPlanStore,
  seedActivePlan,
} from '../../../tests/support/plan-store';
import { UndoToast } from './UndoToast';

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

// The toast reads its record from props but drives undo through the store, so the store
// carries the same pending undo and an active plan for undo to reverse into.
function seedUndo(record: UndoRecord): void {
  act(() => {
    seedActivePlan([]);
    planStore.setState({ pendingUndo: record });
  });
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
