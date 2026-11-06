import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  cleanup,
  act,
  fireEvent,
  within,
} from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import { DEFAULT_WINDOW, SMART_WINDOW } from '@/lib/planner/grid';
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
    rulesTh: '',
    rulesEn: '',
    remark: '',
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
  vi.restoreAllMocks();
  dragStore.getState().clearActive();
  dragStore.getState().clearBlocked();
  dragStore.getState().clearHover();
  dragStore.getState().clearCourse();
  dragStore.getState().clearBlockMove();
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

  it('derives the edit grid minimum width from the window', () => {
    const { rerender } = render(
      <WeeklyGrid
        sections={[]}
        window={SMART_WINDOW}
        locale="th"
        t={t}
        editable
      />,
    );
    const grid = screen.getByRole('group', { name: 'ตารางเรียนรายสัปดาห์' });
    // 40 px of day labels plus 14 px for each of the 40 quarters from 08:00 to 18:00.
    expect(grid.style.minWidth).toBe('600px');
    expect(grid.className).not.toContain('min-w-[44rem]');

    rerender(
      <WeeklyGrid
        sections={[]}
        window={DEFAULT_WINDOW}
        locale="th"
        t={t}
        editable
      />,
    );
    expect(grid.style.minWidth).toBe('824px');
  });

  it('fits an edit block to its box, holding the fit while a drag holds the frame', () => {
    // jsdom performs no layout, so a fit column overflows while it still shows the id.
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(80);
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(
      function (this: HTMLElement) {
        return this.textContent.includes('90592033') ? 100 : 80;
      },
    );
    // A drag is live before the grid mounts, so the block keeps its full field set.
    dragStore.getState().freezeFrame({ window: SMART_WINDOW, days: [1] });
    render(
      <WeeklyGrid
        sections={[makePlaced()]}
        window={SMART_WINDOW}
        locale="th"
        t={t}
        editable
        onRemove={vi.fn()}
      />,
    );
    const block = screen.getByLabelText(/90592033/);
    expect(block.textContent).toContain('90592033');
    // The drag ends and releases the frame: the fit runs and drops the overflowing id.
    act(() => {
      dragStore.getState().clearActive();
    });
    expect(block.textContent).not.toContain('90592033');
    expect(block.textContent).toContain('09:00-12:00');
  });

  it('caps the edit day rows at 7rem and packs them to the top', () => {
    render(
      <WeeklyGrid
        sections={[]}
        window={SMART_WINDOW}
        locale="th"
        t={t}
        editable
        days={[1, 2, 3, 4, 5]}
      />,
    );
    const grid = screen.getByRole('group', { name: 'ตารางเรียนรายสัปดาห์' });
    expect(grid.style.gridTemplateRows).toBe(
      '1.4em repeat(5, minmax(2.5rem, 7rem))',
    );
    expect(grid.style.alignContent).toBe('start');
  });

  it('lets the poster day rows share the template canvas', () => {
    render(
      <WeeklyGrid
        sections={[]}
        window={SMART_WINDOW}
        locale="th"
        t={t}
        days={[1, 2, 3, 4, 5]}
      />,
    );
    const grid = screen.getByRole('group', { name: 'ตารางเรียนรายสัปดาห์' });
    expect(grid.style.gridTemplateRows).toBe(
      '1.4em repeat(5, minmax(2.5rem, 1fr))',
    );
    expect(grid.style.alignContent).toBe('');
  });

  it('pins the block foot to the box bottom on the poster only', () => {
    const footClass = () =>
      within(screen.getByLabelText(/90592033/)).getByText('09:00-12:00')
        .parentElement?.className;
    const { unmount } = render(
      <WeeklyGrid
        sections={[makePlaced()]}
        window={SMART_WINDOW}
        locale="th"
        t={t}
      />,
    );
    expect(footClass()).toContain('mt-auto');
    unmount();
    render(
      <WeeklyGrid
        sections={[makePlaced()]}
        window={SMART_WINDOW}
        locale="th"
        t={t}
        editable
        onRemove={vi.fn()}
      />,
    );
    expect(footClass()).toContain('mt-1');
    expect(footClass()).not.toContain('mt-auto');
  });

  it('keeps the poster grid on its fixed minimum width', () => {
    render(
      <WeeklyGrid sections={[]} window={SMART_WINDOW} locale="th" t={t} />,
    );
    const grid = screen.getByRole('group', { name: 'ตารางเรียนรายสัปดาห์' });
    expect(grid.style.minWidth).toBe('');
    expect(grid.className).toContain('min-w-[44rem]');
  });

  it('drops the poster floor when asked, for a grid that fits its card', () => {
    render(
      <WeeklyGrid
        sections={[]}
        window={SMART_WINDOW}
        locale="th"
        t={t}
        posterFloor={false}
      />,
    );
    const grid = screen.getByRole('group', { name: 'ตารางเรียนรายสัปดาห์' });
    expect(grid.className).not.toContain('min-w-[44rem]');
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

  it('labels every nth hour from the first when the label step is set', () => {
    render(
      <WeeklyGrid
        sections={[]}
        window={SMART_WINDOW}
        locale="th"
        t={t}
        hourLabelStep={2}
      />,
    );
    expect(screen.getByText('08:00')).toBeInTheDocument();
    expect(screen.queryByText('09:00')).toBeNull();
    expect(screen.getByText('10:00')).toBeInTheDocument();
  });

  it('places each hour label as a grid item on its hour track', () => {
    const { rerender } = render(
      <WeeklyGrid sections={[]} window={DEFAULT_WINDOW} locale="th" t={t} />,
    );
    // 08:00 is the second hour of the 07:00 window: quarter tracks 6 to 9 of the axis row.
    const label = screen.getByText('08:00');
    expect(label.style.gridRow).toBe('1');
    expect(label.style.gridColumn).toBe('6 / span 4');
    expect(label.style.transform).toBe('translateX(-50%)');
    // The first label starts the ruler, so it stays inside the grid.
    expect(screen.getByText('07:00').style.transform).toBe('none');

    rerender(
      <WeeklyGrid
        sections={[]}
        window={DEFAULT_WINDOW}
        locale="th"
        t={t}
        orientation="portrait"
      />,
    );
    const portrait = screen.getByText('08:00');
    expect(portrait.style.gridColumn).toBe('1');
    expect(portrait.style.gridRow).toBe('6 / span 4');
    expect(portrait.style.transform).toBe('translateY(-50%)');
  });

  it('draws one hour rule per hour across every day row, stronger at 12:00', () => {
    render(
      <WeeklyGrid sections={[]} window={DEFAULT_WINDOW} locale="th" t={t} />,
    );
    const grid = screen.getByRole('group', { name: 'ตารางเรียนรายสัปดาห์' });
    const all = Array.from(grid.querySelectorAll<HTMLElement>('*')).filter(
      (node) =>
        node.style.gridRow === '2 / -1' &&
        (node.classList.contains('border-l') ||
          node.classList.contains('border-r')),
    );
    const quarterRules = all.filter((node) =>
      node.classList.contains('border-border/45'),
    );
    const rules = all.filter((node) => !quarterRules.includes(node));
    // 07:00 through 21:00 is fifteen hour boundaries, the closing edge included, each one
    // item spanning every day track rather than a gradient per row, and the 42 quarters
    // between them carry the fainter rule the same way.
    expect(rules).toHaveLength(15);
    expect(quarterRules).toHaveLength(42);
    const ruleAt = (column: string): HTMLElement => {
      const rule = rules.find((node) => node.style.gridColumn === column);
      if (rule === undefined) {
        throw new Error(`no rule at column ${column}`);
      }
      return rule;
    };
    // 12:00 opens quarter 20, grid column 22; 13:00 opens column 26.
    expect(ruleAt('22 / span 1').className).toContain('border-grid-strong');
    expect(ruleAt('26 / span 1').className).toContain('border-border');
    // The window edges are strong too; the closing edge draws on the trailing side of the
    // last quarter.
    expect(ruleAt('2 / span 1').className).toContain('border-grid-strong');
    expect(ruleAt('57 / span 1').className).toMatch(
      /border-r .*border-grid-strong/,
    );
    expect(
      rules.filter((node) => node.className.includes('border-grid-strong')),
    ).toHaveLength(3);
  });

  it('pins the day column left and the hour row top in edit', () => {
    render(
      <WeeklyGrid
        sections={[]}
        window={DEFAULT_WINDOW}
        locale="th"
        t={t}
        editable
      />,
    );
    const day = screen.getByLabelText('วันจันทร์');
    expect(day.style.position).toBe('sticky');
    expect(day.style.left).toBe('0px');
    expect(day.style.top).toBe('');
    // A pinned label covers the lanes scrolling under it, so it is never transparent.
    expect(day.className).toMatch(/\bbg-surface(-alt)?\b/);
    const hour = screen.getByText('08:00');
    expect(hour.style.position).toBe('sticky');
    expect(hour.style.top).toBe('0px');
    expect(hour.style.left).toBe('');
  });

  it('lets the sticky day column alone draw the start rule in edit', () => {
    render(
      <WeeklyGrid
        sections={[]}
        window={DEFAULT_WINDOW}
        locale="th"
        t={t}
        editable
      />,
    );
    // Both rules are translucent, so a grid start rule under the day column edge would
    // read darker than the midday and closing rules.
    expect(screen.getByLabelText('วันจันทร์').className).toContain(
      'shadow-[1px_0_0_var(--kcp-grid-strong)]',
    );
    const grid = screen.getByRole('group', { name: 'ตารางเรียนรายสัปดาห์' });
    const strong = Array.from(
      grid.querySelectorAll<HTMLElement>('.border-grid-strong'),
    );
    expect(strong.map((node) => node.style.gridColumn)).toEqual([
      '22 / span 1',
      '57 / span 1',
    ]);
  });

  it('swaps the sticky sides in portrait', () => {
    render(
      <WeeklyGrid
        sections={[]}
        window={DEFAULT_WINDOW}
        locale="th"
        t={t}
        editable
        orientation="portrait"
      />,
    );
    const day = screen.getByLabelText('วันจันทร์');
    expect(day.style.position).toBe('sticky');
    expect(day.style.top).toBe('0px');
    expect(day.style.left).toBe('');
    const hour = screen.getByText('08:00');
    expect(hour.style.position).toBe('sticky');
    expect(hour.style.left).toBe('0px');
    expect(hour.style.top).toBe('');
  });

  it('renders the poster axes flat, with nothing sticky', () => {
    render(
      <WeeklyGrid sections={[]} window={DEFAULT_WINDOW} locale="th" t={t} />,
    );
    const grid = screen.getByRole('group', { name: 'ตารางเรียนรายสัปดาห์' });
    const sticky = Array.from(grid.querySelectorAll<HTMLElement>('*')).filter(
      (node) => node.style.position === 'sticky',
    );
    expect(sticky).toHaveLength(0);
    expect(screen.getByText('08:00').style.position).toBe('');
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
    const target = document.querySelector('[data-swap-target]');
    expect(target).toHaveTextContent('สลับเป็นกลุ่ม 901');
    expect(target).toHaveClass('border-2', 'border-primary');
    expect(target).not.toHaveClass('border-dashed');
    expect(target?.querySelector('.lucide-arrow-left-right')).not.toBeNull();
  });

  it('marks every meeting of a lifted block as its dashed origin', () => {
    const placed = makePlaced({
      teachTableId: 'm1',
      meetings: [
        makeMeeting({ day: 1, startMin: 540, endMin: 660 }),
        makeMeeting({ day: 3, startMin: 540, endMin: 660 }),
      ],
    });
    const lifted = makeSection({
      teachTableId: 'm1',
      meetings: placed.meetings,
    });
    dragStore.getState().startBlockMove(lifted, [lifted], null);
    render(
      <WeeklyGrid
        sections={[placed]}
        window={DEFAULT_WINDOW}
        locale="th"
        t={t}
        editable
        onRemove={() => undefined}
      />,
    );
    const origins = document.querySelectorAll('[data-lifted-origin]');
    expect(origins).toHaveLength(2);
    expect(origins[0]).toHaveClass(
      'border',
      'border-dashed',
      'border-ink-soft',
    );
    expect(origins[0]).toHaveAttribute('aria-hidden', 'true');
    for (const block of screen.getAllByLabelText(/90592033/)) {
      expect(block.parentElement).toHaveClass('opacity-40');
    }
  });

  it('labels a valid block move candidate with the move it performs', () => {
    const origin = makeSection({
      teachTableId: 'm1',
      subjectId: 'S1',
      section: '901',
      meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 660 })],
    });
    const other = makeSection({
      teachTableId: 'm2',
      subjectId: 'S1',
      section: '902',
      meetings: [makeMeeting({ day: 3, startMin: 540, endMin: 660 })],
    });
    dragStore
      .getState()
      .startBlockMove(
        origin,
        [origin],
        makeCourse({ subjectId: 'S1', sections: [origin, other] }),
      );
    render(
      <WeeklyGrid
        sections={[]}
        window={DEFAULT_WINDOW}
        locale="th"
        t={t}
        editable
      />,
    );
    expect(
      document.querySelector('[data-candidate="valid"]'),
    ).toHaveTextContent('ย้ายไปกลุ่ม 902');
  });

  it('cancels a pending hover card on leave and keeps a shown one for the card to close', () => {
    vi.useFakeTimers();
    try {
      act(() => {
        planStore.setState({ entries: [makePlanEntry()] });
      });
      render(
        <WeeklyGrid
          sections={[makePlaced()]}
          window={DEFAULT_WINDOW}
          locale="th"
          t={t}
          editable
          onOpenDetail={() => undefined}
        />,
      );
      const block = screen.getByRole('button', { name: /90592033/ });

      // A pass across the block before the delay never opens the card.
      fireEvent.pointerEnter(block, { pointerType: 'mouse' });
      fireEvent.pointerLeave(block, { pointerType: 'mouse' });
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

      // Once shown, leaving the block toward the card keeps it open.
      fireEvent.pointerEnter(block, { pointerType: 'mouse' });
      act(() => {
        vi.advanceTimersByTime(500);
      });
      const card = screen.getByRole('tooltip');
      fireEvent.pointerLeave(block, { pointerType: 'mouse' });
      fireEvent.mouseLeave(block, { relatedTarget: card });
      fireEvent.mouseMove(card);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('drops a shown hover card when its section leaves the plan, so undo never revives it', () => {
    vi.useFakeTimers();
    try {
      const entry = makePlanEntry();
      act(() => {
        planStore.setState({ entries: [entry] });
      });
      const props = {
        sections: [makePlaced()],
        window: DEFAULT_WINDOW,
        locale: 'th' as const,
        t,
        editable: true,
        onOpenDetail: () => undefined,
      };
      const { rerender } = render(<WeeklyGrid {...props} />);
      fireEvent.pointerEnter(screen.getByRole('button', { name: /90592033/ }), {
        pointerType: 'mouse',
      });
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // The block's own remove control takes the section out under the pointer, so the
      // block never sees a mouse leave.
      act(() => {
        planStore.setState({ entries: [] });
      });
      rerender(<WeeklyGrid {...props} sections={[]} />);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

      // Undo brings the section back on a new block; the old card must not return
      // anchored to the detached node.
      act(() => {
        planStore.setState({ entries: [entry] });
      });
      rerender(<WeeklyGrid {...props} />);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('never opens a hover card for a touch, so a tap shows only the detail sheet', () => {
    vi.useFakeTimers();
    try {
      act(() => {
        planStore.setState({ entries: [makePlanEntry()] });
      });
      render(
        <WeeklyGrid
          sections={[makePlaced()]}
          window={DEFAULT_WINDOW}
          locale="th"
          t={t}
          editable
          onOpenDetail={() => undefined}
        />,
      );
      fireEvent.pointerEnter(screen.getByRole('button', { name: /90592033/ }), {
        pointerType: 'touch',
      });
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
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
      fireEvent.pointerEnter(block, { pointerType: 'mouse' });
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // Pinning a popover drops the shown card at once.
      rerender(<WeeklyGrid {...props} detailOpen />);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

      // Hovering again while pinned never brings it back, so the two detail surfaces
      // never show together.
      fireEvent.pointerEnter(block, { pointerType: 'mouse' });
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
