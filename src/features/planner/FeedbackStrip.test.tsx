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
import { catalogStore } from '@/features/catalog/catalogStore';
import {
  makeCourse,
  makeMeeting,
  makePlanEntry,
  makeSection,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import { dragStore } from './dragStore';
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

function blockedTimeConflict() {
  return [
    {
      kind: 'time' as const,
      blocking: { teachTableId: 'p', subjectId: '90000001', section: '900' },
      day: 1 as const,
      startMin: 540,
      endMin: 600,
    },
  ];
}

afterEach(() => {
  cleanup();
  act(() => {
    planStore.setState({ entries: [], pendingUndo: null });
    dragStore.setState({ active: null, blocked: null, announcement: null });
    catalogStore.getState().resetFilter();
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

  it('shows the blocked reason and a fitting alternative chip', () => {
    const blocked = makeSection({
      teachTableId: 'b',
      subjectId: 'S1',
      section: '901',
      meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 600 })],
    });
    const alternative = makeSection({
      teachTableId: 'a',
      subjectId: 'S1',
      section: '902',
      meetings: [makeMeeting({ day: 2, startMin: 600, endMin: 660 })],
    });
    act(() => {
      dragStore.setState({
        active: null,
        blocked: {
          course: makeCourse({
            subjectId: 'S1',
            sections: [blocked, alternative],
          }),
          section: blocked,
          conflicts: blockedTimeConflict(),
        },
      });
    });
    render(<FeedbackStrip locale="th" t={t} />);
    expect(screen.getByText(/90000001/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /902/ })).toBeInTheDocument();
  });

  it('adds a section from an alternative chip and clears the reason', () => {
    const blocked = makeSection({
      teachTableId: 'b',
      subjectId: 'S1',
      section: '901',
      meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 600 })],
    });
    const alternative = makeSection({
      teachTableId: 'a',
      subjectId: 'S1',
      section: '902',
      meetings: [makeMeeting({ day: 2, startMin: 600, endMin: 660 })],
    });
    act(() => {
      dragStore.setState({
        active: null,
        blocked: {
          course: makeCourse({
            subjectId: 'S1',
            sections: [blocked, alternative],
          }),
          section: blocked,
          conflicts: blockedTimeConflict(),
        },
      });
    });
    render(<FeedbackStrip locale="th" t={t} />);
    fireEvent.click(screen.getByRole('button', { name: /902/ }));
    expect(
      planStore.getState().entries.some((entry) => entry.section === '902'),
    ).toBe(true);
    expect(dragStore.getState().blocked).toBeNull();
  });

  it('reveals the subject in the catalog when no alternative fits', () => {
    const blocked = makeSection({
      teachTableId: 'b',
      subjectId: 'S1',
      section: '901',
    });
    act(() => {
      dragStore.setState({
        active: null,
        blocked: {
          course: makeCourse({ subjectId: 'S1', sections: [blocked] }),
          section: blocked,
          conflicts: [
            {
              kind: 'duplicate',
              blocking: { teachTableId: 'p', subjectId: 'S1', section: '900' },
              subjectId: 'S1',
            },
          ],
        },
      });
    });
    render(<FeedbackStrip locale="th" t={t} />);
    fireEvent.click(screen.getByRole('button', { name: 'แสดงในรายการ' }));
    expect(catalogStore.getState().filter.text).toBe('S1');
    expect(dragStore.getState().blocked).toBeNull();
  });

  it('announces an add in the live region', () => {
    act(() => {
      dragStore.setState({ announcement: 'เพิ่มลงตารางแล้ว 90592008' });
    });
    render(<FeedbackStrip locale="th" t={t} />);
    expect(screen.getByText('เพิ่มลงตารางแล้ว 90592008')).toBeInTheDocument();
  });
});
