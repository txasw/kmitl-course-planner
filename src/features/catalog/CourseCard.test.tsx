import { describe, it, expect, afterEach, vi } from 'vitest';
import { useState, type ComponentProps } from 'react';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { usePlannerSensors } from '@/features/planner/usePlannerSensors';
import { createTranslator, type Translate } from '@/lib/i18n/t';
import type { Section } from '@/lib/domain/types';
import {
  makeCourse,
  makeMeeting,
  makeSection,
} from '../../../tests/support/domain-builders';
import { CourseCard } from './CourseCard';

const t = createTranslator('th');

afterEach(cleanup);

type CardProps = Omit<ComponentProps<typeof CourseCard>, 'open' | 'onToggle'>;

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

  it('collapses an added course, hiding the section rows and the added badge', () => {
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
    expect(screen.queryByText('เพิ่มแล้ว')).not.toBeInTheDocument();
    expect(screen.queryByText(/กลุ่มเรียน 901/)).not.toBeInTheDocument();
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
    expect(screen.getByText(/กลุ่มเรียน 901/)).toBeInTheDocument();
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

  function Harness() {
    const sensors = usePlannerSensors();
    return (
      <DndContext sensors={sensors}>
        <Controlled
          course={course}
          placed={[]}
          locale="th"
          t={t}
          onAdd={() => undefined}
        />
      </DndContext>
    );
  }

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
