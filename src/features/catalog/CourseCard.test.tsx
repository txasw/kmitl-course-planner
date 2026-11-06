import { describe, it, expect, afterEach, vi } from 'vitest';
import { useState, type ComponentProps } from 'react';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { createTranslator, type Translate } from '@/lib/i18n/t';
import type { Section } from '@/lib/domain/types';
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
import { CourseCard } from './CourseCard';
import { HOVER_REST_MS } from './useHoverIntent';

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

  it('lets a vertical swipe on the header scroll the list', () => {
    render(
      <Controlled
        course={course}
        placed={[]}
        locale="th"
        t={t}
        onAdd={() => undefined}
      />,
    );
    expect(surface()).toHaveClass('touch-pan-y');
    expect(surface()).not.toHaveClass('touch-none');
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

  // Pins dnd-kit's own click suppression: once a pointer drag activates, it swallows
  // the click that ends it, so a header drag never toggles the card. A dnd-kit upgrade
  // that drops the behaviour fails here.
  it('does not toggle after a header drag released over the header', () => {
    function Harness() {
      const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
      );
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
    render(<Harness />);
    const button = toggle();
    fireEvent.pointerDown(button, {
      isPrimary: true,
      button: 0,
      clientX: 10,
      clientY: 10,
    });
    fireEvent.pointerMove(document, { clientX: 40, clientY: 12 });
    fireEvent.pointerUp(document, { clientX: 12, clientY: 10 });
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
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
