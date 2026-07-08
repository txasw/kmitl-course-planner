import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import { planStore } from '@/features/plans/planStore';
import {
  makePlanEntry,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import { FeedbackStrip } from './FeedbackStrip';

const t = createTranslator('th');

function seedUndo(): void {
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
  act(() => {
    planStore.setState({ entries: [], pendingUndo: [entry] });
  });
}

afterEach(() => {
  cleanup();
  act(() => {
    planStore.setState({ entries: [], pendingUndo: null });
  });
});

describe('FeedbackStrip', () => {
  it('shows the removed subject with an undo action', () => {
    seedUndo();
    render(<FeedbackStrip locale="th" t={t} />);
    expect(screen.getByText(/90592033/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'เลิกทำ' })).toBeInTheDocument();
  });

  it('restores the removal and closes the window on undo', () => {
    seedUndo();
    render(<FeedbackStrip locale="th" t={t} />);
    fireEvent.click(screen.getByRole('button', { name: 'เลิกทำ' }));
    expect(planStore.getState().entries).toHaveLength(1);
    expect(planStore.getState().pendingUndo).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'เลิกทำ' }),
    ).not.toBeInTheDocument();
  });

  it('closes the undo window after ten seconds', () => {
    vi.useFakeTimers();
    try {
      seedUndo();
      render(<FeedbackStrip locale="th" t={t} />);
      expect(
        screen.getByRole('button', { name: 'เลิกทำ' }),
      ).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(10_000);
      });
      expect(planStore.getState().pendingUndo).toBeNull();
      expect(
        screen.queryByRole('button', { name: 'เลิกทำ' }),
      ).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
