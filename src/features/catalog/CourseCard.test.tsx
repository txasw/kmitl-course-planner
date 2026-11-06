import { describe, it, expect, afterEach, vi } from 'vitest';
import { useState, type ComponentProps } from 'react';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
  within,
} from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { usePlannerSensors } from '@/features/planner/usePlannerSensors';
import { createTranslator, type Translate } from '@/lib/i18n/t';
import type { Course, Section } from '@/lib/domain/types';
import {
  makeCourse,
  makeMeeting,
  makeSection,
} from '../../../tests/support/domain-builders';
import { installViewport } from '../../../tests/support/viewport';
import { fakeSearchDeps } from '../../../tests/support/searchDeps';
import { dragStore } from '@/features/planner/dragStore';
import { Overlay } from '@/features/shell/Overlay';
import { uiStore } from '@/features/shell/uiStore';
import { SearchDepsProvider } from '@/features/search/SearchDepsContext';
import { PanelPortalContext } from '@/features/shell/PanelPortalContext';
import { CatalogDragContext } from './catalogDrag';
import { CourseCard } from './CourseCard';
import { courseToggle } from './courseFocus';
import { HOVER_REST_MS } from './useHoverIntent';

const t = createTranslator('th');
const en = createTranslator('en');

afterEach(cleanup);

type CardProps = Omit<
  ComponentProps<typeof CourseCard>,
  'open' | 'instant' | 'onToggle'
>;

// Holds the open flag the way the catalog does, so a click on the toggle opens and
// closes the card.
function Controlled({
  initialOpen = false,
  ...props
}: CardProps & { initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <CourseCard
      {...props}
      open={open}
      instant={false}
      onToggle={(_subjectId, next) => {
        setOpen(next);
      }}
    />
  );
}

function toggle(): HTMLElement {
  const node = document.querySelector<HTMLElement>('[data-course-toggle]');
  if (node === null) throw new Error('expected the course toggle');
  return node;
}

describe('CourseCard seat status', () => {
  it('shows the remaining count, full, and closed seat lines', () => {
    const course = makeCourse({
      sections: [
        makeSection({
          teachTableId: 'open',
          section: '901',
          seats: { limit: 40, preCount: 0, queueLeft: 7, enrolled: 33 },
        }),
        makeSection({
          teachTableId: 'full',
          section: '902',
          seats: { limit: 40, preCount: 40, queueLeft: 0, enrolled: 'full' },
        }),
        makeSection({ teachTableId: 'closed', section: '903', isClosed: true }),
      ],
    });
    render(
      <Controlled initialOpen course={course} placed={[]} locale="th" t={t} />,
    );
    expect(screen.getByText('ว่าง 7 จาก 40')).toBeInTheDocument();
    expect(screen.getByText('เต็ม เพิ่มไม่ได้')).toBeInTheDocument();
    expect(screen.getByText('ปิด เพิ่มไม่ได้')).toBeInTheDocument();
  });
});

describe('CourseCard plan relation', () => {
  it('marks a time overlap with a different subject as conflicting', () => {
    const section = makeSection({
      subjectId: '90000001',
      section: '901',
      meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 720 })],
    });
    const course = makeCourse({ subjectId: '90000001', sections: [section] });
    const placed = [
      makeSection({
        subjectId: '90000002',
        section: '901',
        teachTableId: 'placed',
        meetings: [makeMeeting({ day: 1, startMin: 600, endMin: 660 })],
      }),
    ];
    render(
      <Controlled
        initialOpen
        course={course}
        placed={placed}
        locale="th"
        t={t}
      />,
    );
    expect(screen.getByText('เวลาชนกัน')).toBeInTheDocument();
  });
});

describe('CourseCard disclosure', () => {
  const course = makeCourse({
    subjectId: '90592008',
    creditStr: '3(3-0-6)',
    sections: [makeSection({ teachTableId: 's1', subjectId: '90592008' })],
  });

  it('starts collapsed with no section row and no section drag surface', () => {
    render(
      <Controlled
        course={course}
        placed={[]}
        locale="th"
        t={t}
        onAdd={() => undefined}
      />,
    );
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/กลุ่มเรียน 901/)).not.toBeInTheDocument();
    expect(document.querySelector('[data-drag-surface="section"]')).toBeNull();
  });

  it('names the toggle by its title and credits and points at its body', () => {
    render(<Controlled course={course} placed={[]} locale="th" t={t} />);
    const button = screen.getByRole('button', {
      name: `90592008 ${course.nameTh} 3(3-0-6)`,
    });
    expect(button).toBe(toggle());
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveAttribute('type', 'button');
    expect(button.closest('h4')).not.toBeNull();
    const body = document.getElementById(
      button.getAttribute('aria-controls') ?? '',
    );
    expect(body).toHaveAttribute('data-course-body');
    expect(body).not.toBeVisible();
  });

  it('names its subject on the card so focus can find its toggle', () => {
    render(<Controlled course={course} placed={[]} locale="th" t={t} />);
    expect(screen.getByRole('article')).toHaveAttribute(
      'data-course-card',
      '90592008',
    );
    expect(courseToggle(document, '90592008')).toBe(toggle());
    expect(courseToggle(document, '90592033')).toBeNull();
  });

  it('opens and closes from a click on the toggle', () => {
    render(
      <Controlled
        course={course}
        placed={[]}
        locale="th"
        t={t}
        onAdd={() => undefined}
      />,
    );
    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/กลุ่มเรียน 901/)).toBeInTheDocument();
    expect(
      document.querySelectorAll('[data-drag-surface="section"]'),
    ).toHaveLength(1);
    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
  });

  it('reports the next state and the placement to the catalog', () => {
    const onToggle = vi.fn();
    render(
      <CourseCard
        course={course}
        placed={[]}
        locale="th"
        t={t}
        open={false}
        instant={false}
        onToggle={onToggle}
      />,
    );
    fireEvent.click(toggle());
    expect(onToggle).toHaveBeenCalledWith('90592008', true, false);
  });

  it('clamps a long title to two lines instead of truncating it', () => {
    render(<Controlled course={course} placed={[]} locale="th" t={t} />);
    const title = document.getElementById(
      toggle().getAttribute('aria-labelledby')?.split(' ')[0] ?? '',
    );
    expect(title).toHaveClass('line-clamp-2', 'break-words');
    expect(title).toHaveTextContent(`90592008 ${course.nameTh}`);
  });
});

describe('CourseCard fit line', () => {
  const course = makeCourse({
    subjectId: '90592008',
    sections: [
      makeSection({
        teachTableId: 's1',
        subjectId: '90592008',
        section: '901',
        meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 720 })],
      }),
      makeSection({
        teachTableId: 's2',
        subjectId: '90592008',
        section: '902',
        meetings: [makeMeeting({ day: 3, startMin: 540, endMin: 720 })],
      }),
    ],
  });

  function meta(): HTMLElement {
    const id = toggle().getAttribute('aria-describedby') ?? '';
    const node = document.getElementById(id);
    if (node === null) throw new Error('expected the described meta line');
    return node;
  }

  it('describes the toggle by the meta line inside it', () => {
    render(<Controlled course={course} placed={[]} locale="th" t={t} />);
    expect(meta()).toHaveAttribute('data-course-meta');
    expect(toggle().contains(meta())).toBe(true);
    expect(toggle()).toHaveAccessibleName(`90592008 ${course.nameTh} 3(3-0-6)`);
  });

  it('shows the section count, the days and the addable count', () => {
    render(<Controlled course={course} placed={[]} locale="th" t={t} />);
    expect(meta()).toHaveTextContent('2 กลุ่มเรียน');
    expect(meta()).toHaveTextContent('เพิ่มได้ 2 กลุ่ม');
  });

  it('hides the short day labels and reads the full day list instead', () => {
    render(<Controlled course={course} placed={[]} locale="th" t={t} />);
    const short = within(meta()).getByText('จ พ');
    expect(short).toHaveAttribute('aria-hidden', 'true');
    expect(within(meta()).getByText('เรียนวันจันทร์และวันพุธ')).toHaveClass(
      'sr-only',
    );
  });

  it('names a course with no meeting and a single section', () => {
    const online = makeCourse({
      sections: [makeSection({ teachTableId: 'o1', meetings: [] })],
    });
    render(<Controlled course={online} placed={[]} locale="en" t={en} />);
    expect(meta()).toHaveTextContent('1 section');
    expect(meta()).toHaveTextContent('No scheduled meeting');
  });

  it('states that every section clashes, in text beside a hidden icon', () => {
    const placed = [
      makeSection({
        teachTableId: 'p1',
        subjectId: 'OTHER',
        meetings: [
          makeMeeting({ day: 1, startMin: 540, endMin: 720 }),
          makeMeeting({ day: 3, startMin: 540, endMin: 720 }),
        ],
      }),
    ];
    render(<Controlled course={course} placed={placed} locale="th" t={t} />);
    const status = within(meta()).getByText('ชนกับตารางทุกกลุ่ม');
    expect(status.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows the other term badge and no fit for a cross term course', () => {
    render(
      <Controlled
        course={course}
        placed={[]}
        locale="th"
        t={t}
        term={{
          planTerm: { year: '2569', semester: '1' },
          browsedTerm: { year: '2569', semester: '2' },
        }}
      />,
    );
    expect(within(meta()).getByText('คนละภาค')).toBeInTheDocument();
    expect(meta()).not.toHaveTextContent('เพิ่มได้');
  });
});

describe('CourseCard disclosure motion', () => {
  const course = makeCourse({
    subjectId: '90592008',
    sections: [makeSection({ teachTableId: 's1', subjectId: '90592008' })],
  });

  function body(): HTMLElement {
    const node = document.querySelector<HTMLElement>('[data-course-body]');
    if (node === null) throw new Error('expected the course body');
    return node;
  }

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('enters through a transition stage', () => {
    render(<Controlled course={course} placed={[]} locale="th" t={t} />);
    fireEvent.click(toggle());
    expect(body()).toHaveAttribute('data-stage', 'entering');
    expect(body()).toHaveClass('kcp-disclosure');
  });

  it('opens with no transition stage under reduced motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }));
    render(<Controlled course={course} placed={[]} locale="th" t={t} />);
    fireEvent.click(toggle());
    expect(body()).toHaveAttribute('data-stage', 'open');
    expect(body()).toBeVisible();
  });

  it('keeps the leaving rows inert, then unmounts them', () => {
    vi.useFakeTimers();
    render(
      <Controlled initialOpen course={course} placed={[]} locale="th" t={t} />,
    );
    fireEvent.click(toggle());
    expect(body()).toHaveAttribute('data-stage', 'leaving');
    expect(body()).toHaveAttribute('inert');
    expect(screen.getByText(/กลุ่มเรียน 901/)).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(body()).toHaveAttribute('data-stage', 'closed');
    expect(body()).not.toHaveAttribute('inert');
    expect(screen.queryByText(/กลุ่มเรียน 901/)).not.toBeInTheDocument();
  });

  it('closes with no leaving stage when the course is added', () => {
    const props = {
      course,
      locale: 'th' as const,
      t,
      instant: false,
      onToggle: () => undefined,
    };
    const placed = [makeSection({ teachTableId: 's1', subjectId: '90592008' })];
    const { rerender } = render(<CourseCard {...props} placed={[]} open />);
    expect(body()).toHaveAttribute('data-stage', 'open');
    // The catalog collapses a card once its course is placed.
    rerender(<CourseCard {...props} placed={placed} open={false} />);
    expect(body()).toHaveAttribute('data-stage', 'closed');
    expect(body()).not.toHaveAttribute('inert');
  });
});

describe('CourseCard reveal on expand', () => {
  const course = makeCourse({
    subjectId: '90592008',
    sections: [makeSection({ teachTableId: 's1', subjectId: '90592008' })],
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setup(initialOpen = false) {
    vi.useFakeTimers();
    const { container } = render(
      <div data-catalog-scroller="">
        <Controlled
          initialOpen={initialOpen}
          course={course}
          placed={[]}
          locale="th"
          t={t}
        />
      </div>,
    );
    const scroller = container.firstElementChild;
    const card = container.querySelector('article');
    if (!(scroller instanceof HTMLElement) || card === null) {
      throw new Error('expected the scroller and the card');
    }
    // The view spans 0 to 300 and the opened card overflows it by 150.
    scroller.getBoundingClientRect = () => new DOMRect(0, 0, 300, 300);
    card.getBoundingClientRect = () => new DOMRect(0, 250, 300, 200);
    const scrollBy = vi.fn();
    scroller.scrollBy = scrollBy;
    return scrollBy;
  }

  it('scrolls an expanded card into view once the open settles', () => {
    const scrollBy = setup();
    fireEvent.click(toggle());
    expect(scrollBy).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(scrollBy).toHaveBeenCalledWith({ top: 150, behavior: 'smooth' });
  });

  it('does not scroll on a collapse', () => {
    const scrollBy = setup(true);
    fireEvent.click(toggle());
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(scrollBy).not.toHaveBeenCalled();
  });
});

describe('CourseCard collapsed added course', () => {
  const section = makeSection({
    subjectId: '90000001',
    section: '901',
    teachTableId: 's901',
    meetings: [makeMeeting({ day: 1 })],
  });
  const course = makeCourse({ subjectId: '90000001', sections: [section] });
  const placed = [
    makeSection({
      subjectId: '90000001',
      section: '901',
      teachTableId: 'placed901',
      meetings: [makeMeeting({ day: 1 })],
    }),
  ];

  function body(): HTMLElement {
    const node = document.querySelector<HTMLElement>('[data-course-body]');
    if (node === null) throw new Error('expected the course body');
    return node;
  }

  it('collapses an added course, hiding the section rows', () => {
    render(
      <Controlled
        course={course}
        placed={placed}
        locale="th"
        t={t}
        onRemove={() => undefined}
      />,
    );
    expect(screen.getByText('90000001')).toBeInTheDocument();
    expect(body().textContent).toBe('');
  });

  it('names the chosen section and its first meeting on the second line', () => {
    render(<Controlled course={course} placed={placed} locale="th" t={t} />);
    const meta = document.getElementById(
      toggle().getAttribute('aria-describedby') ?? '',
    );
    if (meta === null) throw new Error('expected the described meta line');
    expect(toggle().contains(meta)).toBe(true);
    expect(within(meta).getByText('เพิ่มแล้ว')).toBeInTheDocument();
    expect(within(meta).getByText('กลุ่มเรียน 901')).toBeInTheDocument();
    expect(within(meta).getByText('จ 09:00-12:00')).toBeInTheDocument();
    expect(meta).not.toHaveTextContent('เพิ่มได้');
  });

  it('says an added section without a meeting has none', () => {
    const online = makeSection({
      subjectId: '90000001',
      section: '901',
      teachTableId: 'placed901',
      meetings: [],
    });
    render(<Controlled course={course} placed={[online]} locale="en" t={en} />);
    expect(screen.getByText('No scheduled meeting')).toBeInTheDocument();
  });

  it('de-emphasizes an added course with surface-alt, not opacity', () => {
    const { container } = render(
      <Controlled course={course} placed={placed} locale="th" t={t} />,
    );
    const article = container.querySelector('article');
    expect(article?.className).toContain('bg-surface-alt');
    expect(article?.className).not.toContain('opacity');
  });

  it('removes the placed section from a control outside the toggle', () => {
    const onRemove = vi.fn();
    render(
      <Controlled
        course={course}
        placed={placed}
        locale="th"
        t={t}
        onRemove={onRemove}
      />,
    );
    const remove = screen.getByRole('button', {
      name: 'นำออก 90000001 กลุ่มเรียน 901',
    });
    // The visible label starts the accessible name, so speech input reaches it.
    expect(remove.textContent).toBe('นำออก');
    expect(toggle().contains(remove)).toBe(false);
    fireEvent.click(remove);
    expect(onRemove).toHaveBeenCalledWith('placed901');
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
  });

  it('has no course drag surface', () => {
    render(
      <Controlled
        course={course}
        placed={placed}
        locale="th"
        t={t}
        onAdd={() => undefined}
      />,
    );
    expect(document.querySelector('[data-drag-surface="course"]')).toBeNull();
  });

  it('expands to read-only sections with the drag hint and no add label', () => {
    render(
      <Controlled
        course={course}
        placed={placed}
        locale="th"
        t={t}
        onAdd={() => undefined}
        onRemove={() => undefined}
      />,
    );
    fireEvent.click(toggle());
    expect(
      screen.getByText('เปลี่ยนกลุ่มเรียนโดยลากบล็อกในตาราง'),
    ).toBeInTheDocument();
    expect(within(body()).getByText(/กลุ่มเรียน 901/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'เพิ่ม' }),
    ).not.toBeInTheDocument();
    expect(document.querySelector('[data-drag-surface="section"]')).toBeNull();
  });
});

describe('CourseCard course drag header', () => {
  const course = makeCourse({ subjectId: '90592008' });

  function surface(): HTMLElement {
    const node = document.querySelector<HTMLElement>(
      '[data-drag-surface="course"]',
    );
    if (node === null) throw new Error('expected a course drag surface');
    return node;
  }

  it('makes the header a pointer drag source with no accessible name', () => {
    render(
      <Controlled
        course={course}
        placed={[]}
        locale="th"
        t={t}
        onAdd={() => undefined}
      />,
    );
    expect(surface().tagName).toBe('HEADER');
    expect(surface()).not.toHaveAttribute('aria-label');
    expect(surface().contains(toggle())).toBe(true);
  });

  it('lets a swipe on the header scroll the list and leaves a long press to the drag', () => {
    render(
      <Controlled
        course={course}
        placed={[]}
        locale="th"
        t={t}
        onAdd={() => undefined}
      />,
    );
    expect(surface()).toHaveClass('touch-drag');
    expect(surface()).not.toHaveClass('touch-none');
    expect(surface()).not.toHaveClass('touch-pan-y');
  });

  it('omits the course drag surface without an add handler', () => {
    render(<Controlled course={course} placed={[]} locale="th" t={t} />);
    expect(document.querySelector('[data-drag-surface="course"]')).toBeNull();
  });

  it('omits the course drag surface on a cross term card', () => {
    render(
      <Controlled
        course={course}
        placed={[]}
        locale="th"
        t={t}
        term={{
          planTerm: { year: '2569', semester: '2' },
          browsedTerm: { year: '2569', semester: '1' },
        }}
        onAdd={() => undefined}
      />,
    );
    expect(document.querySelector('[data-drag-surface="course"]')).toBeNull();
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
  });

  function Harness({ dragEnabled = true }: { dragEnabled?: boolean }) {
    const sensors = usePlannerSensors();
    return (
      <DndContext sensors={sensors}>
        <CatalogDragContext.Provider value={dragEnabled}>
          <Controlled
            course={course}
            placed={[]}
            locale="th"
            t={t}
            onAdd={() => undefined}
          />
        </CatalogDragContext.Provider>
      </DndContext>
    );
  }

  it('has no course drag surface or grip where the catalog turns drag off', () => {
    render(<Harness dragEnabled={false} />);
    expect(document.querySelector('[data-drag-surface="course"]')).toBeNull();
    expect(document.querySelector('.cursor-grab')).toBeNull();
    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
  });

  // Pins dnd-kit's own click suppression: once a drag activates, it swallows the click
  // that ends it, so a header drag never toggles the card. A dnd-kit upgrade that drops
  // the behaviour fails here.
  it('does not toggle after a mouse drag released over the header', () => {
    render(<Harness />);
    const button = toggle();
    fireEvent.mouseDown(button, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.mouseMove(document, { clientX: 40, clientY: 12 });
    fireEvent.mouseUp(document, { clientX: 12, clientY: 10 });
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('marks the header pressed during a long press and dims it while it drags', () => {
    vi.useFakeTimers();
    try {
      render(<Harness />);
      const button = toggle();
      const at = { clientX: 10, clientY: 10 };
      fireEvent.pointerDown(button, {
        pointerType: 'touch',
        isPrimary: true,
        ...at,
      });
      fireEvent.touchStart(button, { touches: [at], changedTouches: [at] });
      act(() => {
        vi.advanceTimersByTime(120);
      });
      expect(surface()).toHaveClass('outline-border-strong');
      act(() => {
        vi.advanceTimersByTime(130);
      });
      expect(surface()).toHaveClass('opacity-40');
      fireEvent.touchEnd(button, { touches: [], changedTouches: [at] });
      fireEvent.pointerUp(button, { pointerType: 'touch', ...at });
      expect(surface()).not.toHaveClass('opacity-40');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not toggle after a long press drag, while a tap still toggles', () => {
    vi.useFakeTimers();
    try {
      render(<Harness />);
      const button = toggle();
      const at = { clientX: 10, clientY: 10 };
      fireEvent.touchStart(button, { touches: [at], changedTouches: [at] });
      act(() => {
        vi.advanceTimersByTime(300);
      });
      fireEvent.touchEnd(button, { touches: [], changedTouches: [at] });
      fireEvent.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'false');

      // dnd-kit lifts its click guard shortly after the drag ends, then a tap is a click.
      act(() => {
        vi.advanceTimersByTime(100);
      });
      fireEvent.touchStart(button, { touches: [at], changedTouches: [at] });
      fireEvent.touchEnd(button, { touches: [], changedTouches: [at] });
      fireEvent.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'true');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('CourseCard secondary name language', () => {
  const course = makeCourse({
    subjectId: '90000001',
    nameTh: 'วิชาทดสอบ',
    nameEn: 'Test subject',
  });

  it('marks the English secondary name as English in the Thai locale', () => {
    render(
      <Controlled initialOpen course={course} placed={[]} locale="th" t={t} />,
    );
    expect(screen.getByText('Test subject')).toHaveAttribute('lang', 'en');
    // The body repeats the clamped primary name for the eye only.
    const repeated = screen
      .getAllByText('วิชาทดสอบ')
      .filter((node) => !toggle().contains(node));
    expect(repeated).toHaveLength(1);
    expect(repeated[0]).toHaveAttribute('aria-hidden', 'true');
  });

  it('marks the Thai secondary name as Thai in the English locale', () => {
    render(
      <Controlled
        initialOpen
        course={course}
        placed={[]}
        locale="en"
        t={createTranslator('en')}
      />,
    );
    expect(screen.getByText('วิชาทดสอบ')).toHaveAttribute('lang', 'th');
  });

  it('shows the secondary name only when the card is open', () => {
    render(<Controlled course={course} placed={[]} locale="th" t={t} />);
    expect(screen.queryByText('Test subject')).not.toBeInTheDocument();
  });
});

describe('CourseCard grid preview', () => {
  const course = makeCourse({
    subjectId: '90592008',
    sections: [makeSection({ teachTableId: 'p1', subjectId: '90592008' })],
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    act(() => {
      dragStore.setState({ hoverCourse: null });
      uiStore.getState().close();
    });
  });

  function header(): HTMLElement {
    const node = toggle().closest('header');
    if (node === null) throw new Error('expected the card header');
    return node;
  }

  // A deliberate mouse rest on the header: enter, move past the arming distance, rest.
  function restOnHeader(): void {
    fireEvent.pointerEnter(header(), {
      pointerType: 'mouse',
      clientX: 10,
      clientY: 10,
    });
    fireEvent.pointerMove(header(), {
      pointerType: 'mouse',
      clientX: 20,
      clientY: 10,
      buttons: 0,
    });
    act(() => {
      vi.advanceTimersByTime(HOVER_REST_MS);
    });
  }

  function previewed(): string | null {
    return dragStore.getState().hoverCourse?.subjectId ?? null;
  }

  function card(overrides: Partial<CardProps> = {}) {
    return (
      <Controlled
        course={course}
        placed={[]}
        locale="th"
        t={t}
        onAdd={() => undefined}
        {...overrides}
      />
    );
  }

  it('previews the course after a mouse rest on a docked tier', () => {
    installViewport(1366);
    vi.useFakeTimers();
    render(card());
    restOnHeader();
    expect(previewed()).toBe('90592008');
    fireEvent.pointerLeave(header(), { pointerType: 'mouse' });
    expect(previewed()).toBeNull();
  });

  it('offers no preview below the docked tiers', () => {
    installViewport(800);
    vi.useFakeTimers();
    render(card());
    restOnHeader();
    expect(previewed()).toBeNull();
  });

  it('offers no preview on an added card', () => {
    installViewport(1366);
    vi.useFakeTimers();
    render(card({ placed: [makeSection({ subjectId: '90592008' })] }));
    restOnHeader();
    expect(previewed()).toBeNull();
  });

  it('offers no preview on a cross term card', () => {
    installViewport(1366);
    vi.useFakeTimers();
    render(
      card({
        term: {
          planTerm: { year: '2569', semester: '2' },
          browsedTerm: { year: '2569', semester: '1' },
        },
      }),
    );
    restOnHeader();
    expect(previewed()).toBeNull();
  });

  it('previews on a keyboard focus of the toggle and clears on blur', () => {
    installViewport(1366);
    render(card());
    vi.spyOn(toggle(), 'matches').mockImplementation(
      (selector) => selector === ':focus-visible',
    );
    fireEvent.focus(toggle());
    expect(previewed()).toBe('90592008');
    fireEvent.blur(toggle());
    expect(previewed()).toBeNull();
  });

  it('offers no preview on a programmatic focus', () => {
    installViewport(1366);
    render(card());
    act(() => {
      toggle().focus();
    });
    expect(previewed()).toBeNull();
  });

  it('clears the preview on Escape and keeps the overlay open', () => {
    installViewport(1366, { reducedMotion: true });
    vi.useFakeTimers();
    act(() => {
      uiStore.getState().open();
    });
    render(
      <SearchDepsProvider value={fakeSearchDeps()}>
        <Overlay />
        {card()}
      </SearchDepsProvider>,
    );
    restOnHeader();
    expect(previewed()).toBe('90592008');
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(previewed()).toBeNull();
    expect(uiStore.getState().isOpen).toBe(true);
    // The preview stays dismissed until the pointer enters again.
    fireEvent.pointerMove(header(), {
      pointerType: 'mouse',
      clientX: 30,
      clientY: 10,
      buttons: 0,
    });
    act(() => {
      vi.advanceTimersByTime(HOVER_REST_MS);
    });
    expect(previewed()).toBeNull();
    // With nothing left to dismiss, the next Escape closes the overlay as usual.
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(uiStore.getState().isOpen).toBe(false);
  });

  it('clears the preview when the card unmounts', () => {
    installViewport(1366);
    vi.useFakeTimers();
    const { unmount } = render(card());
    restOnHeader();
    expect(previewed()).toBe('90592008');
    unmount();
    expect(previewed()).toBeNull();
  });

  it('clears the preview when the course is added', () => {
    installViewport(1366);
    vi.useFakeTimers();
    const { rerender } = render(card());
    restOnHeader();
    rerender(card({ placed: [makeSection({ subjectId: '90592008' })] }));
    expect(previewed()).toBeNull();
  });

  it('follows a refiltered course while previewing', () => {
    installViewport(1366);
    vi.useFakeTimers();
    const { rerender } = render(card());
    restOnHeader();
    const refiltered = { ...course, sections: [...course.sections] };
    rerender(card({ course: refiltered }));
    expect(dragStore.getState().hoverCourse).toBe(refiltered);
  });
});

describe('CourseCard memoization', () => {
  it('skips re-rendering when its props are unchanged and re-renders on a change', () => {
    // A card renders through t, so counting t calls counts the card's renders: a
    // memo skip runs no more t calls, a real re-render runs a fresh batch.
    let renders = 0;
    const countingT: Translate = (key) => {
      renders += 1;
      return t(key);
    };
    const course = makeCourse({
      subjectId: '90000001',
      sections: [makeSection({ subjectId: '90000001', section: '901' })],
    });
    const placed: Section[] = [];
    const onToggle = () => undefined;
    const props = {
      course,
      placed,
      locale: 'th' as const,
      t: countingT,
      open: true,
      instant: false,
      onToggle,
    };

    const { rerender } = render(<CourseCard {...props} />);
    const afterFirst = renders;
    expect(afterFirst).toBeGreaterThan(0);

    // Identical prop references: the memo skips, so no further t calls.
    rerender(<CourseCard {...props} />);
    expect(renders).toBe(afterFirst);

    // A changed placed reference, as a plan mutation produces: the card re-renders.
    rerender(<CourseCard {...props} placed={[...placed]} />);
    expect(renders).toBeGreaterThan(afterFirst);
  });
});

describe('CourseCard section comparison', () => {
  const twoSections = makeCourse({
    subjectId: '90000001',
    sections: [
      makeSection({ teachTableId: 'a', section: '901' }),
      makeSection({
        teachTableId: 'b',
        section: '902',
        meetings: [makeMeeting({ day: 3 })],
      }),
    ],
  });

  // The overlay shape: the panel is the portal root the comparison dialog renders into.
  function PortalPanel({ course }: { course: Course }) {
    const [node, setNode] = useState<HTMLDivElement | null>(null);
    return (
      <div ref={setNode}>
        <PanelPortalContext.Provider value={node}>
          <Controlled
            initialOpen
            course={course}
            placed={[]}
            locale="th"
            t={t}
          />
        </PanelPortalContext.Provider>
      </div>
    );
  }

  it('offers no compare control for a course with one section', () => {
    render(
      <PortalPanel
        course={makeCourse({ sections: [makeSection({ section: '901' })] })}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'เปรียบเทียบกลุ่มเรียน' }),
    ).toBeNull();
  });

  it('puts the compare control first in the open body', () => {
    render(<PortalPanel course={twoSections} />);
    const body = document.querySelector<HTMLElement>('[data-course-body]');
    if (body === null) throw new Error('expected the course body');
    const [first] = within(body).getAllByRole('button');
    expect(first).toHaveAccessibleName('เปรียบเทียบกลุ่มเรียน');
    expect(first).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('opens the table and returns focus to the control on Escape', () => {
    render(<PortalPanel course={twoSections} />);
    const trigger = screen.getByRole('button', {
      name: 'เปรียบเทียบกลุ่มเรียน',
    });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', {
      name: /เปรียบเทียบกลุ่มเรียน 90000001/,
    });
    expect(within(dialog).getAllByRole('rowheader')).toHaveLength(2);
    fireEvent.keyDown(within(dialog).getByRole('table'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
  });
});
