import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import { TARGET_SIZE } from '@/lib/ui/target';
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
import type { Course } from '@/lib/domain/types';
import type { TypedSend } from '@/lib/messaging/sendTyped';
import { SearchDepsProvider } from '@/features/search/SearchDepsContext';
import { fakeSearchDeps } from '../../../tests/support/searchDeps';
import { dragStore } from './dragStore';
import {
  FeedbackStrip,
  FloatingFeedbackStrip,
  OVERLAY_BOTTOM_PROPERTY,
} from './FeedbackStrip';

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
    searchStore.setState({
      resultQuery: null,
      result: { status: 'idle' },
      activeTab: 'by_class',
    });
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

// A ready catalog result listing the courses, so a reveal has a card to show.
function seedResult(...courses: Course[]): void {
  act(() => {
    searchStore.setState({
      result: {
        status: 'ready',
        data: {
          courses,
          duplicateCount: 0,
          multiMeetingCount: 0,
          warnings: [],
        },
      },
    });
  });
}

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
    const chip = screen.getByRole('button', { name: /902/ });
    for (const token of TARGET_SIZE.split(' ')) {
      expect(chip).toHaveClass(token);
    }
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
    const chip = screen.getByRole('button', { name: /902/ });
    chip.focus();
    fireEvent.click(chip);
    expect(dragStore.getState().crossTerm).not.toBeNull();
    expect(
      planStore.getState().entries.some((entry) => entry.section === '902'),
    ).toBe(false);
    // The chip left with its notice, so focus moves on to the switch that replaced it.
    expect(
      screen.getByRole('button', { name: t('term.switch') }),
    ).toHaveFocus();
  });

  it('reveals the subject in the catalog when no alternative fits', () => {
    const blocked = makeSection({
      teachTableId: 'b',
      subjectId: 'S1',
      section: '901',
    });
    const course = makeCourse({ subjectId: 'S1', sections: [blocked] });
    seedResult(course);
    act(() => {
      dragStore.setState({
        active: null,
        blocked: {
          course,
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
    const course = makeCourse({ subjectId: 'S1', sections: [blocked] });
    seedResult(course);
    act(() => {
      dragStore.setState({
        blocked: {
          course,
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

  it('searches for a course the result no longer lists', () => {
    installViewport(800);
    // A real eight digit id, since the search refuses any other.
    const blocked = makeSection({ teachTableId: 'b', subjectId: '90000002' });
    seedResult(makeCourse({ subjectId: 'S9' }));
    act(() => {
      seedActivePlan([], { year: '2569', semester: '2' });
      dragStore.setState({
        blocked: {
          course: makeCourse({ subjectId: '90000002', sections: [blocked] }),
          section: blocked,
          conflicts: [
            {
              kind: 'duplicate',
              blocking: {
                teachTableId: 'p',
                subjectId: '90000002',
                section: '900',
              },
              subjectId: '90000002',
            },
          ],
        },
      });
    });
    const send = vi.fn(() => new Promise(() => undefined));
    render(
      <SearchDepsProvider
        value={fakeSearchDeps({ send: send as unknown as TypedSend })}
      >
        <FeedbackStrip t={t} />
      </SearchDepsProvider>,
    );
    expect(
      screen.queryByRole('button', { name: 'แสดงในรายการ' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ค้นหารายวิชานี้' }));
    expect(uiStore.getState().sheetOpen).toBe(true);
    expect(searchStore.getState().activeTab).toBe('by_subject_id');
    expect(searchStore.getState().bySubjectId.subjectId).toBe('90000002');
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'teachTable/query' }),
    );
    expect(dragStore.getState().blocked).toBeNull();
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

  describe('floating below the dock', () => {
    afterEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    });

    it('keeps the space it covers clear at the foot of its container', () => {
      vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(
        36,
      );
      showBlockedWithChip();
      const { container, unmount } = render(
        <FeedbackStrip t={t} placement="sheet" />,
      );
      expect(container.style.getPropertyValue(OVERLAY_BOTTOM_PROPERTY)).toBe(
        '60px',
      );
      unmount();
      expect(container.style.getPropertyValue(OVERLAY_BOTTOM_PROPERTY)).toBe(
        '',
      );
    });

    it('rises above a toast at the panel foot', () => {
      installViewport(768);
      vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(
        36,
      );
      showBlockedWithChip();
      act(() => {
        toastStore.getState().show('success', 'ok');
      });
      const { container } = render(<FloatingFeedbackStrip />);
      const node = container.querySelector('[aria-live]');
      expect(node).toHaveClass('bottom-24');
      expect(node).not.toHaveClass('bottom-4');
      expect(container.style.getPropertyValue(OVERLAY_BOTTOM_PROPERTY)).toBe(
        '140px',
      );
      act(() => {
        toastStore.getState().dismiss();
      });
      expect(node).toHaveClass('bottom-4');
    });

    it('rises above the bottom nav of the phone layout', () => {
      installViewport(390);
      vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(
        36,
      );
      showBlockedWithChip();
      const { container } = render(<FloatingFeedbackStrip />);
      const node = container.querySelector('[aria-live]');
      expect(node).toHaveClass('bottom-18');
      expect(node).not.toHaveClass('bottom-4');
      expect(container.style.getPropertyValue(OVERLAY_BOTTOM_PROPERTY)).toBe(
        '116px',
      );
    });

    it('takes the sheet width while the sheet is open', () => {
      act(() => {
        uiStore.getState().setSheetOpen(true);
      });
      const { container } = render(<FloatingFeedbackStrip />);
      expect(container.querySelector('[aria-live]')).toHaveClass('left-4');
    });

    it('reserves nothing while it is empty', () => {
      const { container } = render(<FeedbackStrip t={t} placement="grid" />);
      expect(container.style.getPropertyValue(OVERLAY_BOTTOM_PROPERTY)).toBe(
        '',
      );
    });

    it('reserves nothing in the grid column on a docked tier', () => {
      vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(
        36,
      );
      showBlockedWithChip();
      const { container } = render(<FeedbackStrip t={t} />);
      expect(container.style.getPropertyValue(OVERLAY_BOTTOM_PROPERTY)).toBe(
        '',
      );
    });
  });

  describe('the dismiss control', () => {
    it('clears a blocked notice and is not the strip action', () => {
      showBlockedWithChip();
      render(<FeedbackStrip t={t} />);
      const dismiss = screen.getByRole('button', { name: 'ปิดข้อความ' });
      expect(dismiss).not.toHaveAttribute('data-feedback-action');
      for (const token of TARGET_SIZE.split(' ')) {
        expect(dismiss).toHaveClass(token);
      }
      fireEvent.click(dismiss);
      expect(dragStore.getState().blocked).toBeNull();
    });

    it('clears a hint', () => {
      act(() => {
        dragStore.getState().setHint('วางบนช่องที่ไฮไลต์หรือพื้นที่นำออก');
      });
      render(<FeedbackStrip t={t} />);
      fireEvent.click(screen.getByRole('button', { name: 'ปิดข้อความ' }));
      expect(dragStore.getState().hint).toBeNull();
    });

    it('returns focus to the control the notice took it from', () => {
      showBlockedWithChip();
      render(<StripWithOrigin />);
      const origin = screen.getByRole('button', { name: 'origin' });
      origin.focus();
      const dismiss = screen.getByRole('button', { name: 'ปิดข้อความ' });
      dismiss.focus();
      fireEvent.click(dismiss);
      expect(origin).toHaveFocus();
    });

    it('is absent while only the add line speaks', () => {
      act(() => {
        dragStore.setState({ announcement: 'เพิ่มลงตารางแล้ว 90592008' });
      });
      render(<FeedbackStrip t={t} />);
      expect(
        screen.queryByRole('button', { name: 'ปิดข้อความ' }),
      ).not.toBeInTheDocument();
    });
  });

  describe('the clear window', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    function liveNode(): HTMLElement {
      const node = document.querySelector<HTMLElement>('[aria-live]');
      if (node === null) throw new Error('no live node');
      return node;
    }

    it('clears a blocked notice after six seconds', () => {
      vi.useFakeTimers();
      showBlockedWithChip();
      render(<FeedbackStrip t={t} />);
      act(() => {
        vi.advanceTimersByTime(6_000);
      });
      expect(dragStore.getState().blocked).toBeNull();
    });

    it('holds a notice while the pointer rests on the strip', () => {
      vi.useFakeTimers();
      showBlockedWithChip();
      render(<FeedbackStrip t={t} />);
      act(() => {
        vi.advanceTimersByTime(4_000);
      });
      fireEvent.pointerEnter(liveNode(), { pointerType: 'mouse' });
      act(() => {
        vi.advanceTimersByTime(20_000);
      });
      expect(dragStore.getState().blocked).not.toBeNull();
      // The resume continues from the two seconds left, not a new window.
      fireEvent.pointerLeave(liveNode(), { pointerType: 'mouse' });
      act(() => {
        vi.advanceTimersByTime(1_999);
      });
      expect(dragStore.getState().blocked).not.toBeNull();
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(dragStore.getState().blocked).toBeNull();
    });

    it('is not held by a finger that tapped the strip', () => {
      vi.useFakeTimers();
      showBlockedWithChip();
      render(<FeedbackStrip t={t} />);
      fireEvent.pointerEnter(liveNode(), { pointerType: 'touch' });
      act(() => {
        vi.advanceTimersByTime(6_000);
      });
      expect(dragStore.getState().blocked).toBeNull();
    });

    it('holds a notice while focus is inside it', () => {
      vi.useFakeTimers();
      showBlockedWithChip();
      render(<StripWithOrigin />);
      const chip = screen.getByRole('button', { name: /902/ });
      act(() => {
        chip.focus();
      });
      act(() => {
        vi.advanceTimersByTime(20_000);
      });
      expect(dragStore.getState().blocked).not.toBeNull();
      act(() => {
        screen.getByRole('button', { name: 'elsewhere' }).focus();
      });
      act(() => {
        vi.advanceTimersByTime(6_000);
      });
      expect(dragStore.getState().blocked).toBeNull();
    });

    it('does not hold the next notice once the focused one has gone', () => {
      vi.useFakeTimers();
      showBlockedWithChip();
      render(<StripWithOrigin />);
      act(() => {
        screen.getByRole('button', { name: /902/ }).focus();
      });
      act(() => {
        dragStore.getState().clearBlocked();
        dragStore.getState().setHint('วางบนช่องที่ไฮไลต์เพื่อเพิ่มกลุ่มเรียน');
      });
      act(() => {
        vi.advanceTimersByTime(6_000);
      });
      expect(dragStore.getState().hint).toBeNull();
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
