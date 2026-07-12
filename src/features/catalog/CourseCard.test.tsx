import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
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

describe('CourseCard seat status', () => {
  it('shows the remaining count, full, and closed pills', () => {
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
    render(<CourseCard course={course} placed={[]} locale="th" t={t} />);
    expect(screen.getByText('ว่าง 7')).toBeInTheDocument();
    expect(screen.getByText('เต็ม')).toBeInTheDocument();
    expect(screen.getByText('ปิด')).toBeInTheDocument();
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
    render(<CourseCard course={course} placed={placed} locale="th" t={t} />);
    expect(screen.getByText('เวลาชนกัน')).toBeInTheDocument();
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
      <CourseCard
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
      <CourseCard
        course={course}
        placed={placed}
        locale="th"
        t={t}
        onRemove={() => undefined}
      />,
    );
    const article = container.querySelector('article');
    expect(article?.className).toContain('bg-surface-alt');
    expect(article?.className).not.toContain('opacity');
  });

  it('removes the placed section from the collapsed header', () => {
    const onRemove = vi.fn();
    render(
      <CourseCard
        course={course}
        placed={placed}
        locale="th"
        t={t}
        onRemove={onRemove}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'นำออก' }));
    expect(onRemove).toHaveBeenCalledWith('placed901');
  });

  it('shows the collapsed remove as a quiet icon', () => {
    render(
      <CourseCard
        course={course}
        placed={placed}
        locale="th"
        t={t}
        onRemove={() => undefined}
      />,
    );
    // Icon only: the accessible name is the aria-label and there is no visible text.
    expect(screen.getByRole('button', { name: 'นำออก' }).textContent).toBe('');
  });

  it('makes the whole collapsed summary the expand control', () => {
    render(
      <CourseCard
        course={course}
        placed={placed}
        locale="th"
        t={t}
        onRemove={() => undefined}
      />,
    );
    const toggle = screen.getByRole('button', { expanded: false });
    // The summary names the course rather than being an icon only control, so a
    // click anywhere on it expands.
    expect(toggle).toHaveTextContent('90000001');
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { expanded: true })).toBeInTheDocument();
  });

  it('expands to read-only sections with the drag hint and no add label', () => {
    render(
      <CourseCard
        course={course}
        placed={placed}
        locale="th"
        t={t}
        onAdd={() => undefined}
        onRemove={() => undefined}
      />,
    );
    // The whole collapsed summary is the disclosure button, found by its state.
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(
      screen.getByText('เปลี่ยนกลุ่มเรียนโดยลากบล็อกในตาราง'),
    ).toBeInTheDocument();
    expect(screen.getByText(/กลุ่มเรียน 901/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'เพิ่ม' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('เพิ่มแล้ว')).not.toBeInTheDocument();
  });
});

describe('CourseCard course drag handle', () => {
  it('shows a course drag handle in edit mode with an accessible hint', () => {
    const course = makeCourse({ subjectId: '90592008' });
    render(
      <CourseCard
        course={course}
        placed={[]}
        locale="th"
        t={t}
        onAdd={() => undefined}
      />,
    );
    const surface = document.querySelector('[data-drag-surface="course"]');
    if (surface === null) {
      throw new Error('expected a course drag surface');
    }
    expect(surface.getAttribute('aria-label')).toContain('ลากรายวิชา');
  });

  it('makes the whole header the course drag surface in edit mode', () => {
    const course = makeCourse({ subjectId: '90592008' });
    render(
      <CourseCard
        course={course}
        placed={[]}
        locale="th"
        t={t}
        onAdd={() => undefined}
      />,
    );
    expect(
      document.querySelector('[data-drag-surface="course"]'),
    ).not.toBeNull();
  });

  it('omits the course drag handle without an add handler', () => {
    const course = makeCourse({ subjectId: '90592008' });
    render(<CourseCard course={course} placed={[]} locale="th" t={t} />);
    expect(document.querySelector('[data-drag-surface="course"]')).toBeNull();
  });
});

describe('CourseCard long name', () => {
  it('carries the full name in a tooltip so a truncated name stays readable', async () => {
    const longTh =
      'วิชาที่มีชื่อยาวมากเกินความกว้างของการ์ดรายวิชาจนต้องตัดข้อความ';
    const course = makeCourse({
      subjectId: '90000099',
      nameTh: longTh,
      nameEn: 'A course whose name is long enough to be clipped in the card',
    });
    render(<CourseCard course={course} placed={[]} locale="th" t={t} />);
    // Finding the ancestor by the truncate class also asserts the long name is
    // clipped rather than overflowing the card.
    const named = screen.getByText(longTh).closest('.truncate');
    if (named === null) {
      throw new Error('expected the truncated name element');
    }
    fireEvent.mouseEnter(named);
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('90000099');
    expect(tooltip).toHaveTextContent(longTh);
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
    const props = { course, placed, locale: 'th' as const, t: countingT };

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
