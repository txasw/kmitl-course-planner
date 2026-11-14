import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import { computeSeatStatus } from '@/lib/catalog/seatStatus';
import { normalizeTeachTable } from '@/lib/domain/normalize';
import type { Course, Section } from '@/lib/domain/types';
import { computeSectionRelation } from '@/lib/planner/sectionState';
import { loadFixture } from '../../../tests/support/fixtures';
import {
  makeCourse,
  makeMeeting,
  makeSection,
} from '../../../tests/support/domain-builders';
import { SectionRow } from './SectionRow';

const t = createTranslator('th');
const course = makeCourse();
const section = makeSection();
const openSeat = computeSeatStatus(section);

afterEach(cleanup);

describe('SectionRow actions', () => {
  it('adds an addable open section on click', () => {
    const onAdd = vi.fn();
    render(
      <SectionRow
        course={course}
        section={section}
        relation={{ kind: 'addable' }}
        seat={openSeat}
        locale="th"
        t={t}
        onAdd={onAdd}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^เพิ่ม/ }));
    expect(onAdd).toHaveBeenCalledWith(course, section);
  });

  it('renders the add as an icon rail that names the section', () => {
    render(
      <SectionRow
        course={course}
        section={section}
        relation={{ kind: 'addable' }}
        seat={openSeat}
        locale="th"
        t={t}
        onAdd={vi.fn()}
      />,
    );
    const add = screen.getByRole('button', { name: /^เพิ่ม/ });
    // Icon only, with the accessible name naming the section it adds.
    expect(add.textContent).toBe('');
    expect(add.getAttribute('aria-label')).toContain(section.section);
  });

  it('renders the add rail as a quiet, own column affordance', () => {
    render(
      <SectionRow
        course={course}
        section={section}
        relation={{ kind: 'addable' }}
        seat={openSeat}
        locale="th"
        t={t}
        onAdd={vi.fn()}
      />,
    );
    const add = screen.getByRole('button', { name: /^เพิ่ม/ });
    const tokens = add.className.split(' ');
    // Quiet by default: a soft tinted surface with the accent icon. The solid orange is
    // reserved for the hover and focus states, so it is never the base fill.
    expect(tokens).toContain('bg-primary-soft');
    expect(tokens).not.toContain('bg-primary-strong');
    expect(tokens).toContain('hover:bg-primary-strong');
    // Its own bordered column that never overlaps the row body: it reserves its width
    // (shrink-0, border-l) and sits outside the body content column.
    expect(tokens).toContain('shrink-0');
    expect(tokens).toContain('border-l');
    expect(add.closest('.flex-1')).toBeNull();
  });

  it('removes an added section on click', () => {
    const onRemove = vi.fn();
    render(
      <SectionRow
        course={course}
        section={section}
        relation={{ kind: 'added' }}
        seat={openSeat}
        locale="th"
        t={t}
        onRemove={onRemove}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: `นำออก ${section.subjectId} กลุ่มเรียน ${section.section}`,
      }),
    );
    expect(onRemove).toHaveBeenCalledWith(section.teachTableId);
  });

  it('offers an add button on a conflicting open section that fires the handler', () => {
    const onAdd = vi.fn();
    render(
      <SectionRow
        course={course}
        section={section}
        relation={{ kind: 'conflicting', conflicts: [] }}
        seat={openSeat}
        locale="th"
        t={t}
        onAdd={onAdd}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^เพิ่ม/ }));
    expect(onAdd).toHaveBeenCalledWith(course, section);
  });

  it('offers no add button for a duplicate section', () => {
    render(
      <SectionRow
        course={course}
        section={section}
        relation={{ kind: 'duplicate', subjectId: '90000001' }}
        seat={openSeat}
        locale="th"
        t={t}
        onAdd={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole('button', { name: /^เพิ่ม/ }),
    ).not.toBeInTheDocument();
  });

  it('names a practice section and a lecture section by its kind', () => {
    // Regression guard: the kind rides from lect_or_prac through the section, so a
    // practice section reads practice and a lecture section reads lecture. This is
    // the catalog side of the tag; the shelf and the drag card are covered too.
    const practice = makeSection({ teachTableId: 'p', kind: 'practice' });
    render(
      <SectionRow
        course={course}
        section={practice}
        relation={{ kind: 'addable' }}
        seat={computeSeatStatus(practice)}
        locale="th"
        t={t}
      />,
    );
    expect(screen.getByText('ปฏิบัติ')).toBeInTheDocument();
    expect(screen.queryByText('ทฤษฎี')).not.toBeInTheDocument();
    cleanup();

    const lecture = makeSection({ teachTableId: 'l', kind: 'lecture' });
    render(
      <SectionRow
        course={course}
        section={lecture}
        relation={{ kind: 'addable' }}
        seat={computeSeatStatus(lecture)}
        locale="th"
        t={t}
      />,
    );
    expect(screen.getByText('ทฤษฎี')).toBeInTheDocument();
    expect(screen.queryByText('ปฏิบัติ')).not.toBeInTheDocument();
  });

  it('shows a disabled add rail for a full section', () => {
    const fullSection = makeSection({
      seats: { limit: 40, preCount: 40, queueLeft: 0, enrolled: 'full' },
    });
    render(
      <SectionRow
        course={course}
        section={fullSection}
        relation={{ kind: 'addable' }}
        seat={computeSeatStatus(fullSection)}
        locale="th"
        t={t}
        onAdd={vi.fn()}
      />,
    );
    // The rail stays on the trailing edge but is disabled; the full reason reads
    // from the seat line in the row body.
    expect(screen.getByRole('button', { name: /^เพิ่ม/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByText('เต็ม เพิ่มไม่ได้')).toBeInTheDocument();
  });

  it('keeps the disabled rail focusable with its reason as the description', () => {
    const onAdd = vi.fn();
    const fullSection = makeSection({
      seats: { limit: 40, preCount: 40, queueLeft: 0, enrolled: 'full' },
    });
    render(
      <SectionRow
        course={course}
        section={fullSection}
        relation={{ kind: 'addable' }}
        seat={computeSeatStatus(fullSection)}
        locale="th"
        t={t}
        onAdd={onAdd}
      />,
    );
    const rail = screen.getByRole('button', { name: /^เพิ่ม/ });
    // aria-disabled rather than disabled, so the rail stays in the tab order.
    expect(rail).not.toHaveAttribute('disabled');
    rail.focus();
    expect(rail).toHaveFocus();
    expect(rail).toHaveAccessibleDescription('เต็ม เพิ่มไม่ได้');
    fireEvent.click(rail);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('describes a different term rail with the term mismatch', () => {
    render(
      <SectionRow
        course={course}
        section={section}
        relation={{
          kind: 'different_term',
          planTerm: { year: '2569', semester: '2' },
          browsedTerm: { year: '2569', semester: '1' },
        }}
        seat={openSeat}
        locale="th"
        t={t}
        onAdd={vi.fn()}
      />,
    );
    const rail = screen.getByRole('button', { name: /^เพิ่ม/ });
    expect(rail).toHaveAttribute('aria-disabled', 'true');
    expect(rail).toHaveAccessibleDescription(
      'ตารางอยู่ในภาคการศึกษา 2/2569. กลุ่มเรียนอยู่ในภาค 1/2569',
    );
  });
});

describe('SectionRow status badge', () => {
  const blocking = { teachTableId: 'b', subjectId: '90000002', section: '901' };
  const conflicting = {
    kind: 'conflicting' as const,
    conflicts: [
      {
        kind: 'time' as const,
        blocking,
        day: 1 as const,
        startMin: 540,
        endMin: 600,
      },
    ],
  };

  it('renders the lecture or practice kind as quiet text, not a pill', () => {
    render(
      <SectionRow
        course={course}
        section={section}
        relation={{ kind: 'addable' }}
        seat={openSeat}
        locale="th"
        t={t}
      />,
    );
    const kind = screen.getByText('ทฤษฎี');
    expect(kind).toHaveClass('text-ink-soft');
    expect(kind.className.split(' ').some((c) => c.startsWith('bg-'))).toBe(
      false,
    );
  });

  it('shows no badge on an addable open section', () => {
    render(
      <SectionRow
        course={course}
        section={section}
        relation={{ kind: 'addable' }}
        seat={openSeat}
        locale="th"
        t={t}
      />,
    );
    for (const label of ['เพิ่มแล้ว', 'เวลาชนกัน', 'เต็ม', 'ปิด', 'วิชาซ้ำ']) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });

  it('shows one full badge instead of the conflict badge on a full row', () => {
    const fullSection = makeSection({
      seats: { limit: 40, preCount: 40, queueLeft: 0, enrolled: 'full' },
    });
    render(
      <SectionRow
        course={course}
        section={fullSection}
        relation={conflicting}
        seat={computeSeatStatus(fullSection)}
        locale="th"
        t={t}
        onAdd={vi.fn()}
      />,
    );
    expect(screen.getByText('เต็ม')).toBeVisible();
    expect(screen.queryByText('เวลาชนกัน')).not.toBeInTheDocument();
  });

  it('suppresses the conflict callout on a full or closed row', () => {
    for (const blocked of [
      makeSection({
        seats: { limit: 40, preCount: 40, queueLeft: 0, enrolled: 'full' },
      }),
      makeSection({ isClosed: true }),
    ]) {
      render(
        <SectionRow
          course={course}
          section={blocked}
          relation={conflicting}
          seat={computeSeatStatus(blocked)}
          locale="th"
          t={t}
          onAdd={vi.fn()}
        />,
      );
      expect(screen.queryByText(/^ชนกับ/)).not.toBeInTheDocument();
      expect(screen.getByText(/เพิ่มไม่ได้$/)).toBeVisible();
      cleanup();
    }
  });

  it('keeps the conflict callout on an open conflicting row', () => {
    render(
      <SectionRow
        course={course}
        section={section}
        relation={conflicting}
        seat={openSeat}
        locale="th"
        t={t}
        onAdd={vi.fn()}
      />,
    );
    expect(screen.getByText(/^ชนกับ 90000002/)).toBeVisible();
  });

  it('reads ปิด on a closed row, the host term for a closed section', () => {
    const closed = makeSection({ isClosed: true });
    render(
      <SectionRow
        course={course}
        section={closed}
        relation={conflicting}
        seat={computeSeatStatus(closed)}
        locale="th"
        t={t}
        onAdd={vi.fn()}
      />,
    );
    expect(screen.getByText('ปิด')).toBeVisible();
    expect(screen.queryByText('เวลาชนกัน')).not.toBeInTheDocument();
  });

  it('keeps the badge label visible text with no tooltip', () => {
    render(
      <SectionRow
        course={course}
        section={section}
        relation={conflicting}
        seat={openSeat}
        locale="th"
        t={t}
        onAdd={vi.fn()}
      />,
    );
    const badge = screen.getByText('เวลาชนกัน');
    expect(badge).toBeVisible();
    fireEvent.mouseEnter(badge);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});

describe('SectionRow seat line', () => {
  function renderSeats(target: Section, readOnly = false) {
    render(
      <SectionRow
        course={course}
        section={target}
        relation={{ kind: 'addable' }}
        seat={computeSeatStatus(target)}
        locale="th"
        t={t}
        onAdd={vi.fn()}
        readOnly={readOnly}
      />,
    );
  }

  it('shows the remaining count out of the limit as visible text', () => {
    renderSeats(
      makeSection({
        seats: { limit: 45, preCount: 0, queueLeft: 0, enrolled: 33 },
      }),
    );
    const line = screen.getByText('ว่าง 12 จาก 45');
    expect(line).not.toHaveClass('sr-only');
    expect(line.closest('[role="tooltip"]')).toBeNull();
  });

  it('keeps the seat count visible in a 14rem container', () => {
    const { container } = render(
      <div style={{ width: '14rem' }}>
        <SectionRow
          course={course}
          section={makeSection({
            seats: { limit: 45, preCount: 0, queueLeft: 0, enrolled: 33 },
          })}
          relation={{ kind: 'addable' }}
          seat={{ kind: 'open', remaining: 12 }}
          locale="th"
          t={t}
          onAdd={vi.fn()}
        />
      </div>,
    );
    expect(screen.getByText('ว่าง 12 จาก 45')).toBeVisible();
    // Nothing in the row hides text behind a container query or a visually hidden
    // class, so a narrow drawer row reads the same count a wide one does.
    expect(
      container.querySelectorAll(
        '[class*="@container"], [class*="@max-"], .sr-only',
      ),
    ).toHaveLength(0);
  });

  it('shows no seat limit for an uncapped section', () => {
    renderSeats(
      makeSection({
        seats: { limit: null, preCount: 0, queueLeft: 0, enrolled: 120 },
      }),
    );
    expect(screen.getByText('ไม่จำกัดที่นั่ง')).toBeInTheDocument();
  });

  it('states that a closed section cannot be added', () => {
    renderSeats(makeSection({ isClosed: true }));
    expect(screen.getByText('ปิด เพิ่มไม่ได้')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^เพิ่ม/ }),
    ).toHaveAccessibleDescription('ปิด เพิ่มไม่ได้');
  });

  it('keeps the seat line on a read only row', () => {
    renderSeats(makeSection(), true);
    expect(screen.getByText('ว่าง 40 จาก 40')).toBeInTheDocument();
  });
});

describe('SectionRow demand chip', () => {
  const OVERSUBSCRIBED = makeSection({
    seats: { limit: 45, preCount: 171, queueLeft: 83, enrolled: 'full' },
  });

  function renderDemand(target: Section, readOnly = false) {
    return render(
      <SectionRow
        course={course}
        section={target}
        relation={{ kind: 'addable' }}
        seat={computeSeatStatus(target)}
        locale="th"
        t={t}
        onAdd={vi.fn()}
        readOnly={readOnly}
      />,
    );
  }

  it('flags pre registrations beyond the capacity beside the seat line', () => {
    renderDemand(OVERSUBSCRIBED);
    const chip = screen.getByText(/ล่วงหน้า 171 คิว 83$/);
    expect(chip).toHaveClass('bg-warn-soft', 'text-warn');
    // A screen reader hears the fact the counts stand for ahead of them.
    expect(chip).toHaveTextContent(
      'ลงทะเบียนล่วงหน้าเกินจำนวนรับ ล่วงหน้า 171 คิว 83',
    );
    // The chip sits on the seat line rather than adding a line of its own.
    expect(chip.parentElement).toBe(
      screen.getByText('เต็ม เพิ่มไม่ได้').closest('p')?.parentElement
        ?.parentElement,
    );
  });

  it('keeps the demand counts out of the disabled rail reason', () => {
    renderDemand(OVERSUBSCRIBED);
    expect(
      screen.getByRole('button', { name: /^เพิ่ม/ }),
    ).toHaveAccessibleDescription('เต็ม เพิ่มไม่ได้');
  });

  it('keeps the chip on a read only row', () => {
    renderDemand(OVERSUBSCRIBED, true);
    expect(screen.getByText(/ล่วงหน้า 171 คิว 83$/)).toBeInTheDocument();
  });

  it('shows no chip while pre registrations fit the capacity', () => {
    const { container } = renderDemand(
      makeSection({
        seats: { limit: 45, preCount: 45, queueLeft: 0, enrolled: 33 },
      }),
    );
    expect(screen.queryByText(/ล่วงหน้า/)).toBeNull();
    expect(container.querySelector('.bg-warn-soft')).toBeNull();
  });

  // The sweep renders every section of the full capture, so it needs more
  // than the default budget when the whole suite shares the CPU.
  it('flags exactly the 28 oversubscribed sections of the exam capture', () => {
    const result = normalizeTeachTable(
      loadFixture('teach-table.with-exams.capture.json'),
    );
    if (!result.ok) {
      throw new Error('fixture failed to normalize');
    }
    const flagged: string[] = [];
    for (const captured of result.value.courses) {
      for (const target of captured.sections) {
        const { container, unmount } = render(
          <SectionRow
            course={captured}
            section={target}
            relation={{ kind: 'addable' }}
            seat={computeSeatStatus(target)}
            locale="th"
            t={t}
          />,
        );
        if (container.querySelector('.bg-warn-soft') !== null) {
          flagged.push(`${target.subjectId}/${target.section}`);
        }
        unmount();
      }
    }
    expect(flagged).toHaveLength(28);
    expect(flagged).toContain('96642083/101');
  }, 30_000);
});

describe('SectionRow de-emphasis', () => {
  // The row root is the bordered container the component renders first.
  function rowRoot(container: HTMLElement): Element {
    const root = container.firstElementChild;
    if (root === null) {
      throw new Error('expected the section row root');
    }
    return root;
  }

  it('mutes a duplicate row with the surface alt fill instead of opacity', () => {
    const { container } = render(
      <SectionRow
        course={course}
        section={section}
        relation={{ kind: 'duplicate', subjectId: '90000001' }}
        seat={openSeat}
        locale="th"
        t={t}
      />,
    );
    const root = rowRoot(container);
    expect(root).toHaveClass('bg-surface-alt');
    expect(root.className).not.toMatch(/\bopacity-/);
  });

  it('mutes a different term row without fading its switch action', () => {
    const { container } = render(
      <SectionRow
        course={course}
        section={section}
        relation={{
          kind: 'different_term',
          planTerm: { year: '2569', semester: '1' },
          browsedTerm: { year: '2569', semester: '2' },
        }}
        seat={openSeat}
        locale="th"
        t={t}
        onSwitchTerm={vi.fn()}
      />,
    );
    const root = rowRoot(container);
    expect(root).toHaveClass('bg-surface-alt');
    expect(container.querySelector('[class*="opacity-70"]')).toBeNull();
  });

  it('keeps an addable row on the card surface', () => {
    const { container } = render(
      <SectionRow
        course={course}
        section={section}
        relation={{ kind: 'addable' }}
        seat={openSeat}
        locale="th"
        t={t}
      />,
    );
    expect(rowRoot(container)).not.toHaveClass('bg-surface-alt');
  });
});

describe('SectionRow density and read only', () => {
  it('lists every meeting of a multi meeting section', () => {
    // A section can meet more than once, with the extra periods parsed from
    // teachtime_str. The row lists each meeting, not just the first.
    const multi = makeSection({
      teachTableId: 'mm',
      meetings: [
        makeMeeting({
          day: 4,
          startMin: 525,
          endMin: 615,
          room: '',
          building: '',
        }),
        makeMeeting({
          day: 4,
          startMin: 630,
          endMin: 720,
          room: '',
          building: '',
        }),
      ],
    });
    render(
      <SectionRow
        course={course}
        section={multi}
        relation={{ kind: 'addable' }}
        seat={computeSeatStatus(multi)}
        locale="th"
        t={t}
      />,
    );
    expect(screen.getByText(/08:45-10:15/)).toBeInTheDocument();
    expect(screen.getByText(/10:30-12:00/)).toBeInTheDocument();
  });

  it('shows a room whose building was dropped with a single separating space', () => {
    const coded = makeSection({
      teachTableId: 'coded',
      meetings: [makeMeeting({ room: 'D-510', building: '' })],
    });
    render(
      <SectionRow
        course={course}
        section={coded}
        relation={{ kind: 'addable' }}
        seat={computeSeatStatus(coded)}
        locale="th"
        t={t}
      />,
    );
    expect(screen.getByText(/D-510/).textContent).toMatch(/\d{2}:\d{2} D-510$/);
  });

  it('truncates the teachers to one line with the full list in a tooltip', async () => {
    const many = makeSection({
      teachTableId: 'm',
      teachersTh: ['อ. หนึ่ง', 'อ. สอง', 'อ. สาม'],
    });
    render(
      <SectionRow
        course={course}
        section={many}
        relation={{ kind: 'addable' }}
        seat={computeSeatStatus(many)}
        locale="th"
        t={t}
      />,
    );
    const teachers = screen.getByText('อ. หนึ่ง, อ. สอง, อ. สาม');
    expect(teachers.className).toContain('truncate');
    fireEvent.mouseEnter(teachers);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'อ. หนึ่ง, อ. สอง, อ. สาม',
    );
  });

  it('read only hides the actions and the state badge but keeps the facts', () => {
    const withRemark = makeSection({
      teachTableId: 'ro',
      rulesTh: 'เฉพาะคณะวิศวกรรมศาสตร์',
      remark: 'เปิดสอนร่วมกับคณะอื่น',
    });
    render(
      <SectionRow
        course={course}
        section={withRemark}
        relation={{ kind: 'added' }}
        seat={computeSeatStatus(withRemark)}
        locale="th"
        t={t}
        onRemove={vi.fn()}
        readOnly
      />,
    );
    expect(
      screen.queryByRole('button', { name: /^นำออก/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('เพิ่มแล้ว')).not.toBeInTheDocument();
    expect(screen.getByText('เฉพาะคณะวิศวกรรมศาสตร์')).toBeInTheDocument();
    expect(screen.getByText('เปิดสอนร่วมกับคณะอื่น')).toBeInTheDocument();
  });
});

// 96642011/101 in the exam capture is limited to the faculty and to a dual degree
// international curriculum. Its qualifiers are angle bracketed text in both languages,
// which the sanitizer keeps, so the row must show them as written.
/** A course and one of its sections from the real capture that carries exam windows. */
function withExamsSection(
  subjectId: string,
  code: string,
): { course: Course; section: Section } {
  const result = normalizeTeachTable(
    loadFixture('teach-table.with-exams.capture.json'),
  );
  if (!result.ok) {
    throw new Error('fixture failed to normalize');
  }
  const found = result.value.courses.find((c) => c.subjectId === subjectId);
  const sectionFound = found?.sections.find((s) => s.section === code);
  if (found === undefined || sectionFound === undefined) {
    throw new Error(`fixture is missing ${subjectId} section ${code}`);
  }
  return { course: found, section: sectionFound };
}

function dualDegree(): { course: Course; section: Section } {
  return withExamsSection('96642011', '101');
}

describe('SectionRow conditions and remark', () => {
  it('shows the dual degree conditions with their qualifiers', () => {
    const dual = dualDegree();
    render(
      <SectionRow
        course={dual.course}
        section={dual.section}
        relation={{ kind: 'addable' }}
        seat={computeSeatStatus(dual.section)}
        locale="th"
        t={t}
        onAdd={vi.fn()}
      />,
    );
    expect(screen.getByText('เงื่อนไข')).toBeInTheDocument();
    expect(screen.getByText('เฉพาะคณะวิศวกรรมศาสตร์')).toBeInTheDocument();
    const toggle = screen.getByRole('button', {
      name: 'ดูเงื่อนไขทั้งหมด (3)',
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(
      screen.getByRole('button', { name: 'ซ่อนเงื่อนไข' }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByText(
        'เฉพาะสาขาเทคโนโลยีวัสดุชาญฉลาดและหุ่นยนต์และปัญญาประดิษฐ์ <สองปริญญา><หลักสูตรนานาชาติ> (นน.)',
      ),
    ).toBeInTheDocument();
  });

  it('shows the English conditions in the English locale', () => {
    const dual = dualDegree();
    render(
      <SectionRow
        course={dual.course}
        section={dual.section}
        relation={{ kind: 'addable' }}
        seat={computeSeatStatus(dual.section)}
        locale="en"
        t={createTranslator('en')}
      />,
    );
    expect(screen.getByText('Only School of Engineering').className).toContain(
      'truncate',
    );
    expect(screen.getByRole('list')).toHaveAttribute('lang', 'en');
  });

  it('shows the remark first line inline with a labelled expand control', () => {
    const withRemark = makeSection({
      teachTableId: 'r',
      remark: 'รับเฉพาะนักศึกษาเก็บตกเท่านั้น\nติดต่อภาควิชาก่อนลงทะเบียน',
    });
    render(
      <SectionRow
        course={course}
        section={withRemark}
        relation={{ kind: 'addable' }}
        seat={computeSeatStatus(withRemark)}
        locale="th"
        t={t}
      />,
    );
    expect(screen.getByText('หมายเหตุ')).toBeInTheDocument();
    expect(
      screen.getByText('รับเฉพาะนักศึกษาเก็บตกเท่านั้น'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('ติดต่อภาควิชาก่อนลงทะเบียน'),
    ).not.toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'ดูหมายเหตุทั้งหมด' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(screen.getByText('ติดต่อภาควิชาก่อนลงทะเบียน')).toBeInTheDocument();
  });

  it('adds no condition or remark line to a section without them', () => {
    render(
      <SectionRow
        course={course}
        section={section}
        relation={{ kind: 'addable' }}
        seat={openSeat}
        locale="th"
        t={t}
      />,
    );
    expect(screen.queryByText('เงื่อนไข')).not.toBeInTheDocument();
    expect(screen.queryByText('หมายเหตุ')).not.toBeInTheDocument();
  });
});

// The synthetic exam overlap fixture: 90000010/901 holds a midterm on 21 Aug 2026 from
// 09:00 to 12:00, and 90000011/901 meets on another day but sits its midterm on the same
// morning from 11:00, so placing the first makes the second an exam only clash.
function examOverlapCourses(): {
  placed: Section;
  course: Course;
  incoming: Section;
} {
  const result = normalizeTeachTable(
    loadFixture('synthetic.exam-overlap.json'),
  );
  if (!result.ok) {
    throw new Error('fixture failed to normalize');
  }
  const placedCourse = result.value.courses.find(
    (c) => c.subjectId === '90000010',
  );
  const course = result.value.courses.find((c) => c.subjectId === '90000011');
  const placed = placedCourse?.sections[0];
  const incoming = course?.sections.find((s) => s.section === '901');
  if (course === undefined || placed === undefined || incoming === undefined) {
    throw new Error('fixture is missing the exam overlap sections');
  }
  return { placed, course, incoming };
}

function renderAgainst(placed: Section[], course: Course, incoming: Section) {
  render(
    <SectionRow
      course={course}
      section={incoming}
      relation={computeSectionRelation(placed, course, incoming)}
      seat={computeSeatStatus(incoming)}
      locale="th"
      t={t}
      onAdd={vi.fn()}
    />,
  );
}

describe('SectionRow conflict badge and reason', () => {
  it('badges an exam only clash and names its exam type and Buddhist year date', () => {
    const { placed, course, incoming } = examOverlapCourses();
    renderAgainst([placed], course, incoming);
    expect(screen.getByText('สอบชนกัน')).toBeInTheDocument();
    expect(screen.queryByText('เวลาชนกัน')).not.toBeInTheDocument();
    const reason = screen.getByText(/^เวลาสอบชนกับ/);
    expect(reason).toHaveTextContent('90000010 กลุ่มเรียน 901');
    expect(reason).toHaveTextContent('สอบกลางภาค');
    expect(reason).toHaveTextContent('2569 11:00-13:00');
    expect(reason).not.toHaveTextContent('(+');
  });

  it('keeps the time badge when a time clash leads and counts the exam clash', () => {
    const { placed, course, incoming } = examOverlapCourses();
    // Move the placed section onto the incoming section's meeting, so it clashes in
    // time as well as in the exam window.
    const sameSlot = { ...placed, meetings: incoming.meetings };
    renderAgainst([sameSlot], course, incoming);
    expect(screen.getByText('เวลาชนกัน')).toBeInTheDocument();
    expect(screen.queryByText('สอบชนกัน')).not.toBeInTheDocument();
    const reason = screen.getByText(/^ชนกับ/);
    expect(reason).toHaveTextContent('90000010 กลุ่มเรียน 901');
    expect(reason).toHaveTextContent('13:00-15:00');
    expect(reason).toHaveTextContent('(+1)');
  });

  it('shows the reason in an inline danger soft callout', () => {
    const { placed, course, incoming } = examOverlapCourses();
    renderAgainst([placed], course, incoming);
    const callout = screen.getByText(/^เวลาสอบชนกับ/).closest('p');
    expect(callout).not.toBeNull();
    expect(callout).toHaveClass('bg-danger-soft', 'rounded-kcp-inner');
    expect(callout).toBeVisible();
  });

  it('describes the add rail with the callout on a conflicting row', () => {
    const { placed, course, incoming } = examOverlapCourses();
    renderAgainst([placed], course, incoming);
    const add = screen.getByRole('button', { name: /^เพิ่ม/ });
    expect(add).toHaveAccessibleDescription(/^เวลาสอบชนกับ 90000010/);
  });

  it('gives the add rail no callout description on an addable row', () => {
    render(
      <SectionRow
        course={course}
        section={section}
        relation={{ kind: 'addable' }}
        seat={openSeat}
        locale="th"
        t={t}
        onAdd={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /^เพิ่ม/ })).not.toHaveAttribute(
      'aria-describedby',
    );
  });

  it('names the time clash even when an earlier placed section clashes only in exams', () => {
    const { placed, course, incoming } = examOverlapCourses();
    // The exam only clash comes from the first placed section, so the engine lists it
    // first; the reason must still lead with the time clash the badge announces.
    const timeOnly = makeSection({
      teachTableId: 'time-only',
      subjectId: '90000099',
      section: '902',
      meetings: incoming.meetings,
    });
    renderAgainst([placed, timeOnly], course, incoming);
    expect(screen.getByText('เวลาชนกัน')).toBeInTheDocument();
    const reason = screen.getByText(/^ชนกับ/);
    expect(reason).toHaveTextContent('90000099 กลุ่มเรียน 902');
    expect(reason).toHaveTextContent('(+1)');
  });
});

describe('SectionRow exam line', () => {
  it('shows both exam windows of a real section in the Buddhist year', () => {
    const { course: physics, section: first } = withExamsSection(
      '01006020',
      '1',
    );
    render(
      <SectionRow
        course={physics}
        section={first}
        relation={{ kind: 'addable' }}
        seat={computeSeatStatus(first)}
        locale="th"
        t={t}
        onAdd={vi.fn()}
      />,
    );
    // The capture stores 2026 CE; the row reads 2569 BE like the detail list.
    expect(screen.getByText('กลางภาค').parentElement).toHaveTextContent(
      'กลางภาค 21 ส.ค. 2569 09:30-12:30',
    );
    expect(screen.getByText('ปลายภาค').parentElement).toHaveTextContent(
      'ปลายภาค 30 ต.ค. 2569 09:30-12:30',
    );
    expect(screen.queryByText('จัดสอบเอง')).toBeNull();
  });

  it('reads as arranged by the instructor when the section announces no exam', () => {
    render(
      <SectionRow
        course={course}
        section={section}
        relation={{ kind: 'addable' }}
        seat={openSeat}
        locale="th"
        t={t}
      />,
    );
    expect(screen.getByText('จัดสอบเอง')).toBeInTheDocument();
  });

  it('keeps the exam dates on a read only row, since they are facts', () => {
    const scheduled = makeSection({
      exam: {
        midterm: { start: '2026-08-21 09:30:00', end: '2026-08-21 12:30:00' },
      },
    });
    render(
      <SectionRow
        course={course}
        section={scheduled}
        relation={{ kind: 'added' }}
        seat={computeSeatStatus(scheduled)}
        locale="en"
        t={createTranslator('en')}
        readOnly
      />,
    );
    expect(screen.getByText('Midterm').parentElement).toHaveTextContent(
      'Midterm 21 Aug 2569 09:30-12:30',
    );
  });
});
