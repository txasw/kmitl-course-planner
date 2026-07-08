import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
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
  it('marks a placed section as added', () => {
    const section = makeSection({ subjectId: '90000001', section: '901' });
    const course = makeCourse({ subjectId: '90000001', sections: [section] });
    const placed = [
      makeSection({
        subjectId: '90000001',
        section: '901',
        teachTableId: 'placed',
      }),
    ];
    render(<CourseCard course={course} placed={placed} locale="th" t={t} />);
    expect(screen.getByText('เพิ่มแล้ว')).toBeInTheDocument();
  });

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

  it('marks another section of a placed subject as duplicate', () => {
    const section = makeSection({
      subjectId: '90000001',
      section: '901',
      meetings: [makeMeeting({ day: 1 })],
    });
    const course = makeCourse({ subjectId: '90000001', sections: [section] });
    const placed = [
      makeSection({
        subjectId: '90000001',
        section: '801',
        teachTableId: 'placed',
        meetings: [makeMeeting({ day: 3 })],
      }),
    ];
    render(<CourseCard course={course} placed={placed} locale="th" t={t} />);
    expect(screen.getByText('วิชาซ้ำ')).toBeInTheDocument();
    expect(screen.getByText('มีวิชานี้ในตารางแล้ว')).toBeInTheDocument();
  });
});

describe('CourseCard course drag handle', () => {
  it('shows a course drag handle in edit mode', () => {
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
    expect(screen.getByTitle(/ลากรายวิชา/)).toBeInTheDocument();
  });

  it('omits the course drag handle without an add handler', () => {
    const course = makeCourse({ subjectId: '90592008' });
    render(<CourseCard course={course} placed={[]} locale="th" t={t} />);
    expect(screen.queryByTitle(/ลากรายวิชา/)).not.toBeInTheDocument();
  });
});
