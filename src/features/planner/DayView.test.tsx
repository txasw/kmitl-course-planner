import { describe, it, expect, afterEach, vi } from 'vitest';
import { useState } from 'react';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import { planStore } from '@/features/plans/planStore';
import { SearchDepsProvider } from '@/features/search/SearchDepsContext';
import { PanelPortalContext } from '@/features/shell/PanelPortalContext';
import { uiStore } from '@/features/shell/uiStore';
import { createTranslator } from '@/lib/i18n/t';
import type { DayOfWeek } from '@/lib/parsing/days';
import { dayChipDays, dayFlags } from '@/lib/planner/dayView';
import { planConflicts } from '@/lib/planner/planConflicts';
import {
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
import { PlannerDnd } from './PlannerDnd';
import { PlannerPanel } from './PlannerPanel';

const t = createTranslator('th');

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  act(() => {
    planStore.setState({ entries: [] });
    uiStore.getState().setPlanView('timetable');
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

function ChipsHarness({ initial }: { initial: DayOfWeek }) {
  const [day, setDay] = useState<DayOfWeek>(initial);
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
    expect(
      screen.getByRole('radiogroup', { name: 'วันที่แสดง' }),
    ).toBeVisible();
    expect(chip('วันจันทร์ มีรายการชนกัน')).toBeVisible();
    expect(chip('วันอังคาร')).toBeVisible();
    expect(chip('วันพุธ มีเรียน')).toBeVisible();
    expect(chip('วันเสาร์ มีเรียน')).toBeVisible();
    // Sunday carries no meeting, so the row never offers it.
    expect(screen.queryByRole('radio', { name: /วันอาทิตย์/ })).toBeNull();
    expect(
      screen.getAllByRole('radio').map((node) => node.dataset.day),
    ).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  it('marks class days and conflicts with hidden dots', () => {
    render(<ChipsHarness initial={3} />);
    const dot = (name: string) =>
      chip(name).querySelector('[data-day-dot]')?.getAttribute('data-day-dot');
    expect(dot('วันจันทร์ มีรายการชนกัน')).toBe('conflict');
    expect(dot('วันพุธ มีเรียน')).toBe('class');
    expect(dot('วันอังคาร')).toBe('none');
    expect(
      chip('วันพุธ มีเรียน').querySelector('[data-day-dot]'),
    ).toHaveAttribute('aria-hidden', 'true');
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
    fireEvent.keyDown(chip('วันเสาร์ มีเรียน'), { key: 'ArrowRight' });
    expect(chip('วันจันทร์ มีรายการชนกัน')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(chip('วันจันทร์ มีรายการชนกัน')).toHaveFocus();
    fireEvent.keyDown(chip('วันจันทร์ มีรายการชนกัน'), { key: 'ArrowLeft' });
    expect(chip('วันเสาร์ มีเรียน')).toHaveFocus();
    fireEvent.keyDown(chip('วันเสาร์ มีเรียน'), { key: 'Home' });
    expect(chip('วันจันทร์ มีรายการชนกัน')).toHaveFocus();
    fireEvent.keyDown(chip('วันจันทร์ มีรายการชนกัน'), { key: 'End' });
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

function block(subjectId: string): HTMLElement | null {
  return screen.queryByRole('button', { name: new RegExp(subjectId) });
}

describe('DayView', () => {
  it('opens on the first day with a class below 640 px, one day at a time', () => {
    installViewport(390);
    seedPlan();
    renderPanel();
    expect(
      screen.getByRole('radiogroup', { name: 'วันที่แสดง' }),
    ).toBeVisible();
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
