import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { createTranslator, type Locale } from '@/lib/i18n/t';
import type { WeeklyHours } from '@/lib/planner/credits';
import { WORKING_DAYS, type MeetingSpan } from '@/lib/planner/freePeriods';
import { WorkloadSummary } from './WorkloadSummary';

const HOURS: WeeklyHours = {
  lecture: 5,
  practice: 3,
  selfStudy: 12,
  unstated: 0,
};

// Monday 09:00 to 12:00, Wednesday 09:00 to 10:00 and 13:00 to 16:00, a three hour
// break, and Thursday 08:00 to 10:00 and 12:00 to 14:00, a two hour break. Tuesday
// and Friday stay free.
const MEETINGS: MeetingSpan[] = [
  { day: 1, startMin: 540, endMin: 720 },
  { day: 3, startMin: 540, endMin: 600 },
  { day: 3, startMin: 780, endMin: 960 },
  { day: 4, startMin: 480, endMin: 600 },
  { day: 4, startMin: 720, endMin: 840 },
];

function renderSummary(
  meetings: MeetingSpan[] = MEETINGS,
  hours: WeeklyHours = HOURS,
  locale: Locale = 'th',
) {
  return render(
    <WorkloadSummary
      hours={hours}
      meetings={meetings}
      t={createTranslator(locale)}
    />,
  );
}

function part(name: string): HTMLElement {
  return screen.getByRole('region', { name });
}

afterEach(cleanup);

describe('WorkloadSummary', () => {
  it('is a region named for the workload', () => {
    renderSummary();
    expect(
      screen.getByRole('heading', { level: 3, name: 'ภาระการเรียน' }),
    ).toBeInTheDocument();
    expect(part('ภาระการเรียน')).toBeInTheDocument();
  });

  it('states the weekly lecture, practice and self study hours in the canonical terms', () => {
    renderSummary();
    const hours = part('ชั่วโมงต่อสัปดาห์ตามหน่วยกิต');
    const terms = within(hours)
      .getAllByRole('term')
      .map((term) => term.textContent);
    expect(terms).toEqual(['ทฤษฎี', 'ปฏิบัติ', 'ศึกษาด้วยตนเอง']);
    const values = within(hours)
      .getAllByRole('definition')
      .map((value) => value.textContent);
    expect(values).toEqual(['5 ชม.', '3 ชม.', '12 ชม.']);
    expect(hours).not.toHaveTextContent('ไม่รวม');
  });

  it('says which subjects its sums leave out', () => {
    renderSummary(MEETINGS, { ...HOURS, unstated: 2 });
    expect(part('ชั่วโมงต่อสัปดาห์ตามหน่วยกิต')).toHaveTextContent(
      'ไม่รวม 2 วิชาที่ไม่ระบุชั่วโมงเรียน',
    );
  });

  it('lists the class time of each day that has a class by its full name', () => {
    renderSummary();
    const perDay = part('เวลาเรียนรายวัน');
    expect(
      within(perDay)
        .getAllByRole('term')
        .map((term) => term.textContent),
    ).toEqual(['วันจันทร์', 'วันพุธ', 'วันพฤหัสบดี']);
    expect(
      within(perDay)
        .getAllByRole('definition')
        .map((value) => value.textContent),
    ).toEqual(['3 ชม.', '4 ชม.', '4 ชม.']);
  });

  it('names the free weekdays in full', () => {
    renderSummary();
    const free = part('วันว่าง');
    expect(
      within(free)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['วันอังคาร', 'วันศุกร์']);
  });

  it('lists only the breaks of three hours or more between two classes', () => {
    renderSummary();
    const gaps = part('ช่วงว่างระหว่างคาบตั้งแต่ 3 ชั่วโมง');
    expect(
      within(gaps)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['วันพุธ ว่าง 10:00 ถึง 13:00']);
  });

  it('says so when no weekday is free and no long break exists', () => {
    renderSummary(
      WORKING_DAYS.map((day) => ({ day, startMin: 540, endMin: 720 })),
    );
    expect(part('วันว่าง')).toHaveTextContent(
      'ไม่มีวันว่างในวันจันทร์ถึงวันศุกร์',
    );
    expect(part('ช่วงว่างระหว่างคาบตั้งแต่ 3 ชั่วโมง')).toHaveTextContent(
      'ไม่มีช่วงว่างระหว่างคาบตั้งแต่ 3 ชั่วโมง',
    );
  });

  it('says so when the plan has no scheduled class', () => {
    renderSummary([]);
    expect(part('เวลาเรียนรายวัน')).toHaveTextContent(
      'ยังไม่มีคาบเรียนที่กำหนดวันและเวลา',
    );
  });

  it('reads in English', () => {
    renderSummary(MEETINGS, { ...HOURS, unstated: 1 }, 'en');
    expect(part('Weekly hours by credit')).toHaveTextContent('Lecture5 h');
    expect(part('Weekly hours by credit')).toHaveTextContent(
      'Subjects with no stated hours, not in these totals: 1',
    );
    expect(part('Free weekdays')).toHaveTextContent('TuesdayFriday');
    expect(part('Breaks of 3 hours or more between classes')).toHaveTextContent(
      'Wednesday free 10:00 to 13:00',
    );
  });
});
