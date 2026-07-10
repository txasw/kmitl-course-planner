import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import { computeSeatStatus } from '@/lib/catalog/seatStatus';
import {
  makeCourse,
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
    fireEvent.click(screen.getByRole('button', { name: 'เพิ่ม' }));
    expect(onAdd).toHaveBeenCalledWith(course, section);
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
    fireEvent.click(screen.getByRole('button', { name: 'นำออก' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'เพิ่ม' }));
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
      screen.queryByRole('button', { name: 'เพิ่ม' }),
    ).not.toBeInTheDocument();
  });

  it('badges a practice section and a lecture section by its kind', () => {
    // Regression guard: the kind rides from lect_or_prac through the section, so a
    // practice section reads practice and a lecture section reads lecture. This is
    // the catalog side of the badge; the shelf and the drag card are covered too.
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

  it('offers no add button for a full section', () => {
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
    expect(
      screen.queryByRole('button', { name: 'เพิ่ม' }),
    ).not.toBeInTheDocument();
  });
});
