import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  cleanup,
  act,
  fireEvent,
} from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import { DEFAULT_WINDOW } from '@/lib/planner/grid';
import type { DayOfWeek } from '@/lib/parsing/days';
import {
  makeCourse,
  makeMeeting,
  makePlanEntry,
  makeSection,
} from '../../../tests/support/domain-builders';
import { planStore } from '@/features/plans/planStore';
import { dragStore } from './dragStore';
import { WeeklyGrid } from './WeeklyGrid';
import type { PlacedSection } from './placedSection';

const t = createTranslator('th');

function makePlaced(overrides: Partial<PlacedSection> = {}): PlacedSection {
  return {
    teachTableId: 't1',
    subjectId: '90592033',
    section: '901',
    nameTh: 'วิชาทดสอบ',
    nameEn: 'Test subject',
    credit: 3,
    kind: 'lecture',
    verifyStatus: 'unverified',
    meetings: [
      {
        day: 1,
        startMin: 540,
        endMin: 720,
        room: 'A101',
        building: 'A',
        kind: 'lecture',
      },
    ],
    ...overrides,
  };
}

// The grid item that carries the grid coordinates is the positioning wrapper; the labeled
// block button sits inside it, so read placement from the wrapper.
function blockItem(): HTMLElement {
  const wrapper = screen.getByLabelText(/90592033/).parentElement;
  if (!(wrapper instanceof HTMLElement)) {
    throw new Error('expected a grid item wrapper');
  }
  return wrapper;
}

afterEach(() => {
  cleanup();
  dragStore.getState().clearActive();
  dragStore.getState().clearBlocked();
  dragStore.getState().clearHover();
  dragStore.getState().clearCourse();
  dragStore.getState().setSwapContext(null);
  act(() => {
    planStore.setState({ entries: [] });
  });
});

describe('WeeklyGrid', () => {
  it('places a 09:00 to 12:00 Monday meeting at grid column 10 / 22 in row 3', () => {
    render(
      <WeeklyGrid
        sections={[makePlaced()]}
        window={DEFAULT_WINDOW}
        locale="th"
        t={t}
      />,
    );
    const item = blockItem();
    expect(item.style.gridColumn).toBe('10 / 22');
    expect(item.style.gridRow).toBe('3');
  });

  it('transposes the same meeting to column 3, rows 10 / 22 in portrait', () => {
    // Days become columns and time flows down as rows: Monday is the second day column
    // (grid column 3 after the time axis gutter) and 09:00 to 12:00 spans rows 10 to 22.
    render(
      <WeeklyGrid
        sections={[makePlaced()]}
        window={DEFAULT_WINDOW}
        locale="th"
        t={t}
        orientation="portrait"
      />,
    );
    const item = blockItem();
    expect(item.style.gridColumn).toBe('3');
    expect(item.style.gridRow).toBe('10 / 22');
  });

  it('scales the grid font size from the fontPx prop', () => {
    render(
      <WeeklyGrid
        sections={[]}
        window={DEFAULT_WINDOW}
        locale="th"
        t={t}
        fontPx={14}
      />,
    );
    expect(
      screen.getByRole('group', { name: 'ตารางเรียนรายสัปดาห์' }).style
        .fontSize,
    ).toBe('14px');
  });

  it('trims to a given day run and rows blocks by their position', () => {
    const placed = makePlaced({
      meetings: [
        {
          day: 5,
          startMin: 540,
          endMin: 720,
          room: 'A101',
          building: 'A',
          kind: 'lecture',
        },
      ],
    });
    render(
      <WeeklyGrid
        sections={[placed]}
        window={DEFAULT_WINDOW}
        locale="th"
        t={t}
        days={[1, 2, 3, 4, 5]}
      />,
    );
    // Sunday is trimmed out of the run; Friday stays.
    expect(screen.queryByLabelText('วันอาทิตย์')).not.toBeInTheDocument();
    expect(screen.getByLabelText('วันศุกร์')).toBeInTheDocument();
    // Friday is the fifth row in the run, so the block lands in grid row 2 + 4.
    expect(blockItem().style.gridRow).toBe('6');
  });

  it('emits blocks in day then time order regardless of input order', () => {
    const later = makePlaced({
      teachTableId: 'later',
      subjectId: '90000002',
      meetings: [
        {
          day: 3,
          startMin: 600,
          endMin: 720,
          room: 'B',
          building: 'B',
          kind: 'lecture',
        },
      ],
    });
    const earlier = makePlaced({
      teachTableId: 'earlier',
      subjectId: '90000001',
      meetings: [
        {
          day: 1,
          startMin: 540,
          endMin: 660,
          room: 'A',
          building: 'A',
          kind: 'lecture',
        },
      ],
    });
    render(
      <WeeklyGrid
        sections={[later, earlier]}
        window={DEFAULT_WINDOW}
        locale="th"
        t={t}
      />,
    );
    const ids = Array.from(
      document.querySelectorAll('[data-teach-table-id]'),
    ).map((node) => node.getAttribute('data-teach-table-id'));
    expect(ids).toEqual(['earlier', 'later']);
  });

  it('renders a dense eight subject plan as ordered blocks', () => {
    // A full timetable, eight subjects across the week with two doubled up days, so
    // the grid stays sane at a realistic maximum load and the reading order holds.
    const specs: {
      id: string;
      subjectId: string;
      day: DayOfWeek;
      start: number;
    }[] = [
      { id: 'a', subjectId: '90000005', day: 1, start: 540 },
      { id: 'b', subjectId: '90000001', day: 1, start: 720 },
      { id: 'c', subjectId: '90000002', day: 2, start: 480 },
      { id: 'd', subjectId: '90000003', day: 3, start: 600 },
      { id: 'e', subjectId: '90000004', day: 3, start: 780 },
      { id: 'f', subjectId: '90000006', day: 4, start: 540 },
      { id: 'g', subjectId: '90000007', day: 5, start: 900 },
      { id: 'h', subjectId: '90000008', day: 6, start: 480 },
    ];
    const sections = specs.map((spec) =>
      makePlaced({
        teachTableId: spec.id,
        subjectId: spec.subjectId,
        meetings: [
          makeMeeting({
            day: spec.day,
            startMin: spec.start,
            endMin: spec.start + 60,
          }),
        ],
      }),
    );
    render(
      <WeeklyGrid
        sections={sections}
        window={DEFAULT_WINDOW}
        locale="th"
        t={t}
      />,
    );
    const ids = Array.from(
      document.querySelectorAll('[data-teach-table-id]'),
    ).map((node) => node.getAttribute('data-teach-table-id'));
    // All eight render, in day then start time order.
    expect(ids).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
  });

  it('labels the grid and the seven day rows', () => {
    render(
      <WeeklyGrid sections={[]} window={DEFAULT_WINDOW} locale="th" t={t} />,
    );
    expect(
      screen.getByRole('group', { name: 'ตารางเรียนรายสัปดาห์' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('วันจันทร์')).toBeInTheDocument();
    expect(screen.getByLabelText('วันเสาร์')).toBeInTheDocument();
  });

  it('tints the day row labels only when the export accent is on', () => {
    const { rerender } = render(
      <WeeklyGrid sections={[]} window={DEFAULT_WINDOW} locale="th" t={t} />,
    );
    // Edit mode leaves the label untinted, so the day color never competes with the
    // subject colored blocks.
    expect(screen.getByLabelText('วันจันทร์').style.backgroundColor).toBe('');
    rerender(
      <WeeklyGrid
        sections={[]}
        window={DEFAULT_WINDOW}
        locale="th"
        t={t}
        dayAccent
      />,
    );
    expect(screen.getByLabelText('วันจันทร์').style.backgroundColor).not.toBe(
      '',
    );
  });

  it('shows an hour label at the window start and its last hour', () => {
    render(
      <WeeklyGrid sections={[]} window={DEFAULT_WINDOW} locale="th" t={t} />,
    );
    expect(screen.getByText('07:00')).toBeInTheDocument();
    expect(screen.getByText('20:00')).toBeInTheDocument();
  });

  it('renders a valid footprint ghost during a fitting drag', () => {
    const dragged = makeSection({
      teachTableId: 'd',
      subjectId: 'S1',
      meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 720 })],
    });
    dragStore
      .getState()
      .start(makeCourse({ subjectId: 'S1', sections: [dragged] }), dragged, []);
    render(
      <WeeklyGrid
        sections={[]}
        window={DEFAULT_WINDOW}
        locale="th"
        t={t}
        editable
      />,
    );
    expect(document.querySelector('[data-ghost="valid"]')).not.toBeNull();
    expect(document.querySelector('[data-ghost="blocked"]')).toBeNull();
  });

  it('renders a blocked ghost and pulses the blocking block', () => {
    const placedView = makePlaced({
      teachTableId: 'p',
      subjectId: 'OTHER',
      section: '900',
    });
    const placedDomain = makeSection({
      teachTableId: 'p',
      subjectId: 'OTHER',
      section: '900',
      meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 720 })],
    });
    const dragged = makeSection({
      teachTableId: 'd',
      subjectId: 'S1',
      meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 720 })],
    });
    dragStore
      .getState()
      .start(makeCourse({ subjectId: 'S1', sections: [dragged] }), dragged, [
        placedDomain,
      ]);
    render(
      <WeeklyGrid
        sections={[placedView]}
        window={DEFAULT_WINDOW}
        locale="th"
        t={t}
        editable
      />,
    );
    expect(document.querySelector('[data-ghost="blocked"]')).not.toBeNull();
    expect(screen.getByLabelText(/OTHER/).className).toContain('kcp-pulse');
  });

  it('renders a low emphasis hover ghost while previewing', () => {
    const preview = makeSection({
      teachTableId: 'h',
      meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 720 })],
    });
    dragStore.getState().setHover(preview);
    render(
      <WeeklyGrid
        sections={[]}
        window={DEFAULT_WINDOW}
        locale="th"
        t={t}
        editable
      />,
    );
    expect(document.querySelector('[data-ghost="hover"]')).not.toBeNull();
  });

  it('hides a lingering drag overlay when not editable, so preview stays inert', () => {
    const preview = makeSection({
      teachTableId: 'h',
      meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 720 })],
    });
    dragStore.getState().setHover(preview);
    render(
      <WeeklyGrid sections={[]} window={DEFAULT_WINDOW} locale="th" t={t} />,
    );
    expect(document.querySelector('[data-ghost="hover"]')).toBeNull();
  });

  it('renders candidate slots during a course drag', () => {
    const valid = makeSection({
      teachTableId: 'c1',
      section: '901',
      meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 660 })],
    });
    const full = makeSection({
      teachTableId: 'c2',
      section: '902',
      meetings: [makeMeeting({ day: 3, startMin: 540, endMin: 660 })],
      seats: { limit: 40, preCount: 40, queueLeft: 0, enrolled: 'full' },
    });
    const course = makeCourse({ sections: [valid, full] });
    dragStore.getState().startCourse(course, []);
    render(
      <WeeklyGrid
        sections={[]}
        window={DEFAULT_WINDOW}
        locale="th"
        t={t}
        editable
      />,
    );
    expect(document.querySelector('[data-candidate="valid"]')).not.toBeNull();
    expect(document.querySelector('[data-candidate="blocked"]')).not.toBeNull();
    expect(screen.getByText('901')).toBeInTheDocument();
  });

  it('renders swap targets over the blocking blocks during a blocked drag', () => {
    const blocker = makePlaced({
      teachTableId: 'p',
      subjectId: 'OTHER',
      section: '900',
    });
    const incoming = makeSection({
      teachTableId: 'i',
      subjectId: 'S1',
      section: '901',
      meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 720 })],
    });
    dragStore.getState().setSwapContext({
      incoming,
      course: makeCourse({ subjectId: 'S1', sections: [incoming] }),
      originId: null,
      blockers: ['p'],
    });
    render(
      <WeeklyGrid
        sections={[blocker]}
        window={DEFAULT_WINDOW}
        locale="th"
        t={t}
        editable
      />,
    );
    expect(document.querySelector('[data-swap-target]')).not.toBeNull();
  });

  it('opens a hover card on a block but never while a detail popover is pinned', () => {
    vi.useFakeTimers();
    try {
      // The hover card reads the plan entry snapshot by teachTableId, so seed one.
      act(() => {
        planStore.setState({ entries: [makePlanEntry()] });
      });
      const props = {
        sections: [makePlaced()],
        window: DEFAULT_WINDOW,
        locale: 'th' as const,
        t,
        editable: true,
        onOpenDetail: () => {
          /* no op: the test drives detailOpen directly */
        },
      };
      const { rerender } = render(<WeeklyGrid {...props} detailOpen={false} />);
      const block = screen.getByRole('button', { name: /90592033/ });

      // With no popover pinned, hovering opens the read only card after the delay.
      fireEvent.mouseEnter(block);
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // Pinning a popover drops the shown card at once.
      rerender(<WeeklyGrid {...props} detailOpen />);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

      // Hovering again while pinned never brings it back, so the two detail surfaces
      // never show together.
      fireEvent.mouseEnter(block);
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
