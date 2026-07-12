import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import type { TeachTableQuery } from '@/lib/messaging/protocol';
import { planStore } from '@/features/plans/planStore';
import { searchStore } from '@/features/search/searchStore';
import { catalogStore } from '@/features/catalog/catalogStore';
import {
  makeCourse,
  makeMeeting,
  makePlanEntry,
  makeSection,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import {
  resetPlanStore,
  seedActivePlan,
} from '../../../tests/support/plan-store';
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
    seedActivePlan([]);
    planStore.setState({
      pendingUndo: { kind: 'remove', added: [], removed: [entry] },
    });
  });
}

function makeMoveEntry(subjectId: string, nameTh: string) {
  return makePlanEntry({
    snapshot: makeSnapshot({
      teachTableId: `tt-${subjectId}`,
      subjectId,
      subjectMeta: {
        subjectId,
        nameTh,
        nameEn: 'name',
        credit: 3,
        creditStr: '3(3-0-6)',
      },
    }),
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

const QUERY_S2: TeachTableQuery = {
  mode: 'by_subject_id',
  selected_year: '2569',
  selected_semester: '2',
  search_all_faculty: true,
  search_all_department: true,
  search_all_curriculum: true,
  search_all_class_year: true,
  selected_subject_id: '90000000',
};

afterEach(() => {
  cleanup();
  act(() => {
    resetPlanStore();
    searchStore.setState({ resultQuery: null });
    dragStore.setState({
      active: null,
      blocked: null,
      crossTerm: null,
      announcement: null,
      hint: null,
    });
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

  it('names the moved subject rather than a removal after a move', () => {
    act(() => {
      planStore.setState({
        entries: [],
        pendingUndo: {
          kind: 'move',
          added: [makeMoveEntry('90000003', 'วิชาซี')],
          removed: [makeMoveEntry('90000003', 'วิชาซี')],
        },
      });
    });
    render(<FeedbackStrip locale="th" t={t} />);
    expect(screen.getByText(/ย้ายแล้ว 90000003/)).toBeInTheDocument();
    expect(screen.queryByText(/นำออกแล้ว/)).not.toBeInTheDocument();
  });

  it('names the swapped in subject after a swap', () => {
    act(() => {
      planStore.setState({
        entries: [],
        pendingUndo: {
          kind: 'swap',
          added: [makeMoveEntry('90000002', 'วิชาบี')],
          removed: [makeMoveEntry('90000001', 'วิชาเอ')],
        },
      });
    });
    render(<FeedbackStrip locale="th" t={t} />);
    expect(screen.getByText(/สลับเป็น 90000002/)).toBeInTheDocument();
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
      // A search context so the add stamps a term rather than being refused.
      searchStore.setState({ resultQuery: QUERY_S2 });
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

  it('routes a cross term alternative to the cross term notice', () => {
    // The plan is a first semester term but the catalog is browsed in the second,
    // so adding an alternative from the chip is a cross term add.
    act(() => {
      seedActivePlan([], { year: '2569', semester: '1' });
      searchStore.setState({ resultQuery: QUERY_S2 });
    });
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
    expect(dragStore.getState().crossTerm).not.toBeNull();
    expect(
      planStore.getState().entries.some((entry) => entry.section === '902'),
    ).toBe(false);
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

  it('shows a course drop hint', () => {
    act(() => {
      dragStore.setState({ hint: 'วางบนช่องที่ไฮไลต์เพื่อเพิ่มกลุ่มเรียน' });
    });
    render(<FeedbackStrip locale="th" t={t} />);
    expect(
      screen.getByText('วางบนช่องที่ไฮไลต์เพื่อเพิ่มกลุ่มเรียน'),
    ).toBeInTheDocument();
  });
});
