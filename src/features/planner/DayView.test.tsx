import { describe, it, expect, afterEach, vi } from 'vitest';
import { useState } from 'react';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
  waitFor,
  within,
} from '@testing-library/react';
import { planStore } from '@/features/plans/planStore';
import { revalidationStore } from '@/features/plans/revalidationStore';
import { SearchDepsProvider } from '@/features/search/SearchDepsContext';
import { PanelPortalContext } from '@/features/shell/PanelPortalContext';
import { uiStore } from '@/features/shell/uiStore';
import { createTranslator } from '@/lib/i18n/t';
import {
  dayChipDays,
  dayFlags,
  type TimetableChoice,
} from '@/lib/planner/dayView';
import { planConflicts } from '@/lib/planner/planConflicts';
import { gridFontPx } from '@/lib/ui/breakpoints';
import {
  makeCourse,
  makeMeeting,
  makePlanEntry,
  makeSection,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import { fakeSearchDeps } from '../../../tests/support/searchDeps';
import { swipe } from '../../../tests/support/swipe';
import { installViewport } from '../../../tests/support/viewport';
import { DayChips } from './DayChips';
import { dragStore } from './dragStore';
import { AXIS_TRACK_EM } from './gridGeometry';
import { PlannerDnd } from './PlannerDnd';
import { PlannerPanel } from './PlannerPanel';

const t = createTranslator('th');

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  act(() => {
    planStore.setState({ entries: [] });
    uiStore.getState().setPlanView('timetable');
    uiStore.getState().setTimetableView('day');
    dragStore.getState().clearActive();
    dragStore.getState().clearBlockMove();
  });
});

// Monday has a time conflict between two sections, Wednesday a single class, and
// Saturday a class, so the row offers the week plus Saturday.
const conflicting = [
  makeSection({
    teachTableId: 'a',
    subjectId: '90000001',
    meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 660 })],
  }),
  makeSection({
    teachTableId: 'b',
    subjectId: '90000002',
    meetings: [
      makeMeeting({ day: 1, startMin: 600, endMin: 720 }),
      makeMeeting({ day: 3, startMin: 540, endMin: 600 }),
      makeMeeting({ day: 6, startMin: 540, endMin: 600 }),
    ],
  }),
];
const meetings = conflicting.flatMap((section) => section.meetings);
const flags = dayFlags(meetings, planConflicts(conflicting));
const days = dayChipDays(meetings);

function ChipsHarness({ initial }: { initial: TimetableChoice }) {
  const [day, setDay] = useState<TimetableChoice>(initial);
  return (
    <DayChips
      days={days}
      selected={day}
      flags={flags}
      onSelect={setDay}
      t={t}
    />
  );
}

function chip(name: string): HTMLElement {
  return screen.getByRole('radio', { name });
}

describe('DayChips', () => {
  it('names the group and each chip by its full day name and state', () => {
    render(<ChipsHarness initial={3} />);
    expect(screen.getByRole('radiogroup', { name: 'วันที่แสดง' })).toBeVisible();
    expect(chip('วันจันทร์ มีรายการชนกัน')).toBeVisible();
    expect(chip('วันอังคาร')).toBeVisible();
    expect(chip('วันพุธ มีเรียน')).toBeVisible();
    expect(chip('วันเสาร์ มีเรียน')).toBeVisible();
    // Sunday carries no meeting, so the row never offers it.
    expect(screen.queryByRole('radio', { name: /วันอาทิตย์/ })).toBeNull();
    // The week chip leads the row, so the one group arranges the whole timetable.
    expect(chip('สัปดาห์')).toBeVisible();
    expect(
      screen.getAllByRole('radio').map((node) => node.dataset.day),
    ).toEqual(['week', '1', '2', '3', '4', '5', '6']);
  });

  it('marks the chosen chip by weight, outline, and an underline bar, not colour alone', () => {
    render(<ChipsHarness initial={3} />);
    const chosen = chip('วันพุธ มีเรียน');
    expect(chosen).toHaveClass('font-semibold', 'ring-1', 'ring-inset');
    expect(chosen.querySelector('[data-chip-bar]')).toHaveAttribute(
      'data-chip-bar',
      'on',
    );
    const other = chip('วันอังคาร');
    expect(other).not.toHaveClass('font-semibold');
    expect(other).not.toHaveClass('ring-1');
    expect(other.querySelector('[data-chip-bar]')).toHaveAttribute(
      'data-chip-bar',
      'off',
    );
    // The bar sits in the flow under the label, never laid over it.
    expect(chosen.querySelector('[data-chip-bar]')).not.toHaveClass('absolute');
  });

  it('checks the week chip for the week and leaves every day unchecked', () => {
    render(<ChipsHarness initial="week" />);
    expect(chip('สัปดาห์')).toHaveAttribute('aria-checked', 'true');
    expect(chip('สัปดาห์')).toHaveAttribute('tabindex', '0');
    expect(chip('สัปดาห์')).toHaveTextContent('สัปดาห์');
    expect(chip('วันพุธ มีเรียน')).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(chip('วันพุธ มีเรียน'));
    expect(chip('วันพุธ มีเรียน')).toHaveAttribute('aria-checked', 'true');
    expect(chip('สัปดาห์')).toHaveAttribute('aria-checked', 'false');
  });

  it('marks class days and conflicts with hidden dots', () => {
    render(<ChipsHarness initial={3} />);
    const dot = (name: string) =>
      chip(name).querySelector('[data-day-dot]')?.getAttribute('data-day-dot');
    expect(dot('วันจันทร์ มีรายการชนกัน')).toBe('conflict');
    expect(dot('วันพุธ มีเรียน')).toBe('class');
    expect(dot('วันอังคาร')).toBe('none');
    expect(chip('วันพุธ มีเรียน').querySelector('[data-day-dot]')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  it('checks the shown day and keeps only it in the tab order', () => {
    render(<ChipsHarness initial={3} />);
    expect(chip('วันพุธ มีเรียน')).toHaveAttribute('aria-checked', 'true');
    expect(chip('วันพุธ มีเรียน')).toHaveAttribute('tabindex', '0');
    expect(chip('วันอังคาร')).toHaveAttribute('aria-checked', 'false');
    expect(chip('วันอังคาร')).toHaveAttribute('tabindex', '-1');
  });

  it('selects a day on click', () => {
    render(<ChipsHarness initial={3} />);
    fireEvent.click(chip('วันอังคาร'));
    expect(chip('วันอังคาร')).toHaveAttribute('aria-checked', 'true');
  });

  it('moves the choice and focus with the arrow keys, wrapping at the ends', () => {
    render(<ChipsHarness initial={6} />);
    // The row wraps from its last day to the week chip that leads it, then to Monday.
    fireEvent.keyDown(chip('วันเสาร์ มีเรียน'), { key: 'ArrowRight' });
    expect(chip('สัปดาห์')).toHaveAttribute('aria-checked', 'true');
    expect(chip('สัปดาห์')).toHaveFocus();
    fireEvent.keyDown(chip('สัปดาห์'), { key: 'ArrowRight' });
    expect(chip('วันจันทร์ มีรายการชนกัน')).toHaveAttribute('aria-checked', 'true');
    expect(chip('วันจันทร์ มีรายการชนกัน')).toHaveFocus();
    fireEvent.keyDown(chip('วันจันทร์ มีรายการชนกัน'), { key: 'ArrowLeft' });
    expect(chip('สัปดาห์')).toHaveFocus();
    fireEvent.keyDown(chip('สัปดาห์'), { key: 'ArrowLeft' });
    expect(chip('วันเสาร์ มีเรียน')).toHaveFocus();
    fireEvent.keyDown(chip('วันเสาร์ มีเรียน'), { key: 'Home' });
    expect(chip('สัปดาห์')).toHaveFocus();
    fireEvent.keyDown(chip('สัปดาห์'), { key: 'End' });
    expect(chip('วันเสาร์ มีเรียน')).toHaveAttribute('aria-checked', 'true');
  });
});

// Two subjects: one on Wednesday morning and one on Friday afternoon.
function seedPlan(): void {
  act(() => {
    planStore.setState({
      entries: [
        makePlanEntry({
          teachTableId: 'wed',
          snapshot: makeSnapshot({
            teachTableId: 'wed',
            subjectId: '90000001',
            meetings: [makeMeeting({ day: 3, startMin: 540, endMin: 720 })],
          }),
        }),
        makePlanEntry({
          teachTableId: 'fri',
          snapshot: makeSnapshot({
            teachTableId: 'fri',
            subjectId: '90000002',
            meetings: [makeMeeting({ day: 5, startMin: 780, endMin: 900 })],
          }),
        }),
      ],
    });
  });
}

function renderPanel() {
  return render(
    <SearchDepsProvider value={fakeSearchDeps()}>
      <PanelPortalContext.Provider value={document.body}>
        <PlannerDnd>
          <PlannerPanel />
        </PlannerDnd>
      </PanelPortalContext.Provider>
    </SearchDepsProvider>,
  );
}

/** Whether a grid notice is an item of the edit grid spanning its body, past the axis. */
function noticeOverBody(notice: string): boolean {
  const node = document.querySelector(`[data-grid-notice="${notice}"]`);
  return (
    node instanceof HTMLElement &&
    node.parentElement?.hasAttribute('data-edit-grid') === true &&
    node.style.gridRow === '2 / -1' &&
    node.style.gridColumn === '2 / -1'
  );
}

/**
 * Whether a grid notice is the shared empty state with nothing floating over the
 * gridlines: no bordered or shadowed surface and no tinted icon disc inside it.
 */
function noticeBelongsToGrid(notice: string): boolean {
  const node = document.querySelector(`[data-grid-notice="${notice}"]`);
  return (
    node !== null &&
    node.querySelector('[data-empty-state]') !== null &&
    node.querySelector('.border, .shadow-kcp, .bg-primary-soft') === null
  );
}

function block(subjectId: string): HTMLElement | null {
  return screen.queryByRole('button', { name: new RegExp(subjectId) });
}

describe('DayView', () => {
  it('opens on the first day with a class below 640 px, one day at a time', () => {
    installViewport(390);
    seedPlan();
    renderPanel();
    expect(screen.getByRole('radiogroup', { name: 'วันที่แสดง' })).toBeVisible();
    expect(chip('วันพุธ มีเรียน')).toHaveAttribute('aria-checked', 'true');
    expect(
      screen.getByRole('group', { name: 'ตารางเรียนวันพุธ' }),
    ).toBeInTheDocument();
    expect(block('90000001')).not.toBeNull();
    expect(block('90000002')).toBeNull();
  });

  it('shows the picked day and names a free day', () => {
    installViewport(390);
    seedPlan();
    renderPanel();
    fireEvent.click(chip('วันศุกร์ มีเรียน'));
    expect(block('90000002')).not.toBeNull();
    expect(block('90000001')).toBeNull();
    expect(document.querySelector('[data-grid-notice="free-day"]')).toBeNull();

    fireEvent.click(chip('วันอังคาร'));
    const note = document.querySelector('[data-grid-notice="free-day"]');
    expect(note).toHaveTextContent('วันอังคาร');
    expect(note).toHaveTextContent('วันว่าง');
    // The sticky hour column would otherwise cover the card's leading edge.
    expect(noticeOverBody('free-day')).toBe(true);
    // The free day reads like every other empty state in the panel, not a card laid over
    // the lanes.
    expect(noticeBelongsToGrid('free-day')).toBe(true);
  });

  it('opens each shown day scrolled to its first class', () => {
    installViewport(390);
    // jsdom has no layout, so a block reports its top from its start time: 0.8 px a
    // minute down from an 08:00 window start, under a 17 px header, less the scroll.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        const order = this.dataset.blockOrder;
        const scrolled = this.closest('.overflow-auto')?.scrollTop ?? 0;
        const top =
          order === undefined
            ? 0
            : ((Number(order) % 1440) - 480) * 0.8 + 17 - scrolled;
        return DOMRect.fromRect({ x: 0, y: top, width: 100, height: 40 });
      },
    );
    const fontPx = gridFontPx(0);
    const opensAt = (top: number): number =>
      Math.round(top - AXIS_TRACK_EM * fontPx - fontPx);
    const scroller = (day: string): HTMLElement | null =>
      screen.getByRole('group', { name: `ตารางเรียน${day}` }).parentElement;
    seedPlan();
    renderPanel();
    // Wednesday at 09:00 and Friday at 13:00.
    expect(scroller('วันพุธ')?.scrollTop).toBe(opensAt(65));
    fireEvent.click(chip('วันศุกร์ มีเรียน'));
    expect(scroller('วันศุกร์')?.scrollTop).toBe(opensAt(257));

    // A manual scroll on the same day holds; a free day opens at the top.
    const friday = scroller('วันศุกร์');
    if (friday !== null) friday.scrollTop = 40;
    act(() => {
      uiStore.getState().setPlanView('timetable');
    });
    expect(friday?.scrollTop).toBe(40);
    fireEvent.click(chip('วันอังคาร'));
    expect(scroller('วันอังคาร')?.scrollTop).toBe(0);
  });

  it('shows the day an updated section meets on from the updates dialog', async () => {
    installViewport(390);
    // jsdom has no layout and does not implement scrollIntoView.
    Element.prototype.scrollIntoView = vi.fn();
    seedPlan();
    const friday = planStore.getState().entries[1];
    if (friday === undefined) throw new Error('seed lost its Friday entry');
    act(() => {
      planStore.setState({
        entries: [
          ...planStore.getState().entries.slice(0, 1),
          {
            ...friday,
            verifyStatus: 'changed',
            review: {
              kinds: ['room_changed'],
              before: friday.snapshot,
              detectedAt: '2026-11-06T00:00:00.000Z',
              notifiedAt: null,
            },
          },
        ],
      });
    });
    renderPanel();
    expect(chip('วันพุธ มีเรียน')).toHaveAttribute('aria-checked', 'true');
    act(() => {
      revalidationStore.getState().setUpdatesOpen(true);
    });
    fireEvent.click(
      screen.getByRole('button', {
        name: `ดูในตาราง 90000002 กลุ่มเรียน ${friday.section}`,
      }),
    );
    expect(chip('วันศุกร์ มีเรียน')).toHaveAttribute('aria-checked', 'true');
    const target = block('90000002');
    await waitFor(() => {
      expect(target).toHaveFocus();
    });
    expect(target).toHaveClass('kcp-locate');
  });

  it('centers the empty plan notice over the lanes, clear of the hour column', () => {
    installViewport(390);
    renderPanel();
    expect(noticeOverBody('empty')).toBe(true);
    expect(noticeBelongsToGrid('empty')).toBe(true);
  });

  it('hides the day notices under a drag or a grip preview and brings them back', () => {
    installViewport(390);
    const section = makeSection({
      teachTableId: 'd1',
      subjectId: '90000009',
      // Monday is the day an empty plan shows, Tuesday the free day picked below.
      meetings: [
        makeMeeting({ day: 1, startMin: 540, endMin: 720 }),
        makeMeeting({ day: 2, startMin: 540, endMin: 720 }),
      ],
    });
    const course = makeCourse({ subjectId: '90000009', sections: [section] });
    renderPanel();
    const empty = document.querySelector('[data-grid-notice="empty"]');
    expect(empty).toBeVisible();
    act(() => {
      dragStore.getState().start(course, section, []);
    });
    expect(document.querySelector('[data-ghost="valid"]')).not.toBeNull();
    expect(empty).not.toBeVisible();
    // A cancelled drag ends the same way as a drop that commits nothing.
    act(() => {
      dragStore.getState().clearActive();
    });
    expect(empty).toBeVisible();
    cleanup();

    // The free day of a plan with classes yields too, here to the preview a focused grip
    // paints, the keyboard path to the same cells.
    seedPlan();
    renderPanel();
    fireEvent.click(chip('วันอังคาร'));
    const free = document.querySelector('[data-grid-notice="free-day"]');
    expect(free).toBeVisible();
    act(() => {
      dragStore.getState().setHover(section);
    });
    expect(document.querySelector('[data-ghost="hover"]')).not.toBeNull();
    expect(free).not.toBeVisible();
    act(() => {
      dragStore.getState().clearHover();
    });
    expect(free).toBeVisible();
  });

  it('keeps the picked day across a switch to the selected courses and back', () => {
    installViewport(390);
    seedPlan();
    renderPanel();
    fireEvent.click(chip('วันศุกร์ มีเรียน'));
    act(() => {
      uiStore.getState().setPlanView('selected');
    });
    expect(screen.queryByRole('radiogroup')).toBeNull();
    act(() => {
      uiStore.getState().setPlanView('timetable');
    });
    expect(chip('วันศุกร์ มีเรียน')).toHaveAttribute('aria-checked', 'true');
    expect(block('90000002')).not.toBeNull();
  });

  it('shows the week with no day chips from 640 px', () => {
    installViewport(1366);
    seedPlan();
    renderPanel();
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(
      screen.getByRole('group', { name: 'ตารางเรียนรายสัปดาห์' }),
    ).toBeInTheDocument();
    expect(block('90000001')).not.toBeNull();
    expect(block('90000002')).not.toBeNull();
  });

  it('paints drag feedback for the shown day only', () => {
    installViewport(390);
    seedPlan();
    renderPanel();
    act(() => {
      dragStore.getState().setHover(
        makeSection({
          teachTableId: 'c1',
          subjectId: '90000003',
          meetings: [
            makeMeeting({ day: 3, startMin: 780, endMin: 840 }),
            makeMeeting({ day: 4, startMin: 780, endMin: 840 }),
          ],
        }),
      );
    });
    // The Thursday meeting is off the shown Wednesday, so it never lands on the axis.
    expect(document.querySelectorAll('[data-ghost="hover"]')).toHaveLength(1);
    act(() => {
      dragStore.getState().clearHover();
    });
  });

  it('keeps a block draggable through a long press', () => {
    vi.useFakeTimers();
    installViewport(390);
    seedPlan();
    renderPanel();
    const target = block('90000001');
    if (target === null) throw new Error('expected the Wednesday block');
    const at = { clientX: 40, clientY: 40 };
    fireEvent.touchStart(target, { touches: [at], changedTouches: [at] });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(dragStore.getState().blockMove?.section.teachTableId).toBe('wed');
    fireEvent.touchEnd(target, { touches: [], changedTouches: [at] });
    // The sensor removes its click guard on a short timer after the drag ends; run it so
    // the guard never outlives the test and swallows a later click.
    act(() => {
      vi.runOnlyPendingTimers();
    });
  });
});

describe('Timetable week chip', () => {
  function layout(name: string): HTMLElement {
    return within(
      screen.getByRole('radiogroup', { name: 'วันที่แสดง' }),
    ).getByRole('radio', { name });
  }

  // The grid item that carries the grid coordinates wraps the labeled block button.
  function blockItem(subjectId: string): HTMLElement {
    const wrapper = block(subjectId)?.parentElement;
    if (!(wrapper instanceof HTMLElement)) {
      throw new Error('expected a grid item wrapper');
    }
    return wrapper;
  }

  it('opens on the day view with a day chip checked below 640 px', () => {
    installViewport(390);
    seedPlan();
    renderPanel();
    expect(layout('วันพุธ มีเรียน')).toHaveAttribute('aria-checked', 'true');
    expect(layout('สัปดาห์')).toHaveAttribute('aria-checked', 'false');
    // The chip row is the one control: no separate day or week toggle renders.
    expect(screen.queryByRole('button', { name: 'สัปดาห์' })).toBeNull();
  });

  it('switches to the portrait week and back from the same row, remembering the choice', () => {
    installViewport(390);
    seedPlan();
    renderPanel();
    fireEvent.click(layout('สัปดาห์'));
    expect(uiStore.getState().timetableView).toBe('week');
    // The row stays in place on the week, so a day is one tap away.
    expect(screen.getByRole('radiogroup', { name: 'วันที่แสดง' })).toBeVisible();
    expect(
      screen.getByRole('group', { name: 'ตารางเรียนรายสัปดาห์' }),
    ).toBeInTheDocument();
    // Both days show at once, as day columns from Monday: Wednesday is column 4 and
    // Friday column 6, with the time flowing down the rows.
    expect(blockItem('90000001').style.gridColumn).toBe('4');
    expect(blockItem('90000002').style.gridColumn).toBe('6');
    expect(blockItem('90000001').style.gridRow).toContain(' / ');
    expect(layout('สัปดาห์')).toHaveAttribute('aria-checked', 'true');
    expect(layout('วันพุธ มีเรียน')).toHaveAttribute('aria-checked', 'false');

    // A day chip returns to the day view on the day it names.
    fireEvent.click(layout('วันศุกร์ มีเรียน'));
    expect(uiStore.getState().timetableView).toBe('day');
    expect(layout('วันศุกร์ มีเรียน')).toHaveAttribute('aria-checked', 'true');
    expect(
      screen.getByRole('group', { name: 'ตารางเรียนวันศุกร์' }),
    ).toBeInTheDocument();
    expect(block('90000001')).toBeNull();
  });

  it('opens on a remembered week', () => {
    act(() => {
      uiStore.getState().setTimetableView('week');
    });
    installViewport(390);
    seedPlan();
    renderPanel();
    expect(layout('สัปดาห์')).toHaveAttribute('aria-checked', 'true');
    expect(block('90000001')).not.toBeNull();
    expect(block('90000002')).not.toBeNull();
  });

  it('hides the chip row and shows the landscape week from 640 px', () => {
    act(() => {
      uiStore.getState().setTimetableView('week');
    });
    installViewport(1366);
    seedPlan();
    renderPanel();
    expect(screen.queryByRole('radiogroup', { name: 'วันที่แสดง' })).toBeNull();
    // Landscape puts the day on the row and the time on the columns.
    expect(blockItem('90000001').style.gridColumn).toContain(' / ');
    expect(blockItem('90000001').style.gridRow).toBe('4');
  });
});

describe('DayView swipe', () => {
  function swipeSurface(): Element {
    const surface = document.querySelector('[data-day-swipe]');
    if (surface === null)
      throw new Error('expected the day view swipe surface');
    return surface;
  }

  function shown(): string | undefined {
    return screen
      .getAllByRole('radio')
      .find((node) => node.getAttribute('aria-checked') === 'true')?.dataset
      .day;
  }

  it('steps to the next day on a swipe left and back on a swipe right', () => {
    installViewport(390);
    seedPlan();
    renderPanel();
    expect(shown()).toBe('3');
    swipe(swipeSurface(), 'x', -100);
    expect(shown()).toBe('4');
    swipe(swipeSurface(), 'x', 100);
    swipe(swipeSurface(), 'x', 100);
    expect(shown()).toBe('2');
  });

  it('stops at the end of the row rather than wrapping', () => {
    installViewport(390);
    seedPlan();
    renderPanel();
    fireEvent.click(chip('วันศุกร์ มีเรียน'));
    expect(shown()).toBe('5');
    swipe(swipeSurface(), 'x', -100);
    expect(shown()).toBe('5');
  });

  it('stops at Monday rather than landing on the week chip beside it', () => {
    installViewport(390);
    seedPlan();
    renderPanel();
    fireEvent.click(chip('วันจันทร์'));
    expect(shown()).toBe('1');
    swipe(swipeSurface(), 'x', 100);
    expect(shown()).toBe('1');
    expect(chip('สัปดาห์')).toHaveAttribute('aria-checked', 'false');
  });

  it('ignores a move under the slop, a short swipe, and a vertical swipe', () => {
    installViewport(390);
    seedPlan();
    renderPanel();
    swipe(swipeSurface(), 'x', -20);
    swipe(swipeSurface(), 'x', -60);
    swipe(swipeSurface(), 'y', -100);
    expect(shown()).toBe('3');
  });

  it('leaves the day alone while a drag owns the pointer', () => {
    installViewport(390);
    seedPlan();
    renderPanel();
    const section = makeSection({ teachTableId: 'wed' });
    act(() => {
      dragStore.setState({
        blockMove: { section, group: [section], course: null, candidates: [] },
      });
    });
    swipe(swipeSurface(), 'x', -100);
    expect(shown()).toBe('3');
  });

  it('claims a sideways touch move from the browser and leaves a vertical one', () => {
    installViewport(390);
    seedPlan();
    renderPanel();
    const touch = (x: number, y: number) => ({
      touches: [{ clientX: x, clientY: y }],
    });
    fireEvent.touchStart(swipeSurface(), touch(100, 100));
    // fireEvent returns false when a listener cancelled the event.
    expect(fireEvent.touchMove(swipeSurface(), touch(80, 104))).toBe(false);
    fireEvent.touchStart(swipeSurface(), touch(100, 100));
    expect(fireEvent.touchMove(swipeSurface(), touch(104, 70))).toBe(true);
  });
});
