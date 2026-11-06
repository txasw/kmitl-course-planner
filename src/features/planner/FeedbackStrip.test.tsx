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
import { confirmAdd } from '@/features/plans/addToPlan';
import { searchStore } from '@/features/search/searchStore';
import { catalogStore } from '@/features/catalog/catalogStore';
import { Toaster } from '@/features/shell/Toaster';
import { toastStore } from '@/features/shell/toastStore';
import { uiStore } from '@/features/shell/uiStore';
import { installViewport } from '../../../tests/support/viewport';
import {
  makeCourse,
  makeMeeting,
  makeSection,
} from '../../../tests/support/domain-builders';
import {
  resetPlanStore,
  seedActivePlan,
} from '../../../tests/support/plan-store';
import { dragStore } from './dragStore';
import { FeedbackStrip } from './FeedbackStrip';

const t = createTranslator('th');

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
    uiStore.getState().setSheetOpen(false);
    uiStore.getState().setCatalogVisible(true);
  });
  vi.unstubAllGlobals();
});

// A blocked add of section 901 whose alternative 902 fits, so the strip shows one chip.
function showBlockedWithChip(): void {
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
}

// The strip beside the add control a blocked add came from, and one other control.
function StripWithOrigin() {
  return (
    <>
      <button type="button">origin</button>
      <button type="button">elsewhere</button>
      <FeedbackStrip t={t} />
    </>
  );
}

describe('FeedbackStrip', () => {
  it('returns focus to its origin when the notice clears under it', () => {
    showBlockedWithChip();
    render(<StripWithOrigin />);
    const origin = screen.getByRole('button', { name: 'origin' });
    origin.focus();
    screen.getByRole('button', { name: /902/ }).focus();
    act(() => {
      dragStore.getState().clearBlocked();
    });
    expect(origin).toHaveFocus();
  });

  it('leaves focus that moved on before the notice cleared', () => {
    showBlockedWithChip();
    render(<StripWithOrigin />);
    screen.getByRole('button', { name: 'origin' }).focus();
    screen.getByRole('button', { name: /902/ }).focus();
    const elsewhere = screen.getByRole('button', { name: 'elsewhere' });
    elsewhere.focus();
    act(() => {
      dragStore.getState().clearBlocked();
    });
    expect(elsewhere).toHaveFocus();
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
    render(<FeedbackStrip t={t} />);
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
    render(<FeedbackStrip t={t} />);
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
    render(<FeedbackStrip t={t} />);
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
    render(<FeedbackStrip t={t} />);
    fireEvent.click(screen.getByRole('button', { name: 'แสดงในรายการ' }));
    expect(catalogStore.getState().filter.text).toBe('S1');
    expect(dragStore.getState().blocked).toBeNull();
  });

  it.each([
    [1280, 'catalogVisible' as const],
    [800, 'sheetOpen' as const],
  ])('shows the catalog when revealing at %i px', (width, shown) => {
    installViewport(width);
    act(() => {
      uiStore.getState().setCatalogVisible(false);
    });
    const blocked = makeSection({ teachTableId: 'b', subjectId: 'S1' });
    act(() => {
      dragStore.setState({
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
    render(<FeedbackStrip t={t} />);
    fireEvent.click(screen.getByRole('button', { name: 'แสดงในรายการ' }));
    expect(uiStore.getState()[shown]).toBe(true);
  });

  it('announces an add in the live region', () => {
    act(() => {
      dragStore.setState({ announcement: 'เพิ่มลงตารางแล้ว 90592008' });
    });
    render(<FeedbackStrip t={t} />);
    expect(screen.getByText('เพิ่มลงตารางแล้ว 90592008')).toBeInTheDocument();
  });

  describe('a catalog add confirmation', () => {
    const added = makeSection({ subjectId: '90592033', section: '901' });

    // Every polite region the add could speak through, with its current text.
    function spokenRegions(container: HTMLElement): string[] {
      return [...container.querySelectorAll('[aria-live]')]
        .map((region) => region.textContent)
        .filter((text) => text !== '');
    }

    afterEach(() => {
      vi.unstubAllGlobals();
      act(() => {
        toastStore.getState().dismiss();
        uiStore.getState().close();
      });
    });

    it('is read once from the strip while the timetable is in view', () => {
      installViewport(1280);
      act(() => {
        uiStore.getState().open();
      });
      const { container } = render(
        <>
          <FeedbackStrip t={t} />
          <Toaster />
        </>,
      );
      act(() => {
        confirmAdd(added, t);
      });
      expect(spokenRegions(container)).toEqual(['เพิ่มลงตารางแล้ว 90592033']);
    });

    it('is read once from the toast while the sheet covers the timetable', () => {
      installViewport(768);
      act(() => {
        uiStore.getState().open();
        uiStore.getState().setSheetOpen(true);
      });
      const { container } = render(
        <>
          <FeedbackStrip t={t} />
          <Toaster />
        </>,
      );
      act(() => {
        confirmAdd(added, t);
      });
      expect(dragStore.getState().announcement).toBeNull();
      expect(spokenRegions(container)).toEqual([
        'เพิ่ม 90592033 กลุ่มเรียน 901 แล้วดูตาราง',
      ]);
    });
  });

  it('shows a course drop hint', () => {
    act(() => {
      dragStore.setState({ hint: 'วางบนช่องที่ไฮไลต์เพื่อเพิ่มกลุ่มเรียน' });
    });
    render(<FeedbackStrip t={t} />);
    expect(
      screen.getByText('วางบนช่องที่ไฮไลต์เพื่อเพิ่มกลุ่มเรียน'),
    ).toBeInTheDocument();
  });
});
