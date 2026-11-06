import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { createTranslator, type Locale } from '@/lib/i18n/t';
import type { PlanEntry } from '@/lib/domain/plan';
import type { Exam } from '@/lib/domain/types';
import { buildExamSchedule } from '@/lib/planner/examSchedule';
import {
  makePlanEntry,
  makeSection,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import { ExamSchedulePanel } from './ExamSchedulePanel';

// 2026-12-17 is a Thursday, shown as 17 ธ.ค. 2569 in the Buddhist year.
const MID_A = { start: '2026-12-17 09:00:00', end: '2026-12-17 12:00:00' };
const MID_B = { start: '2026-12-17 10:00:00', end: '2026-12-17 13:00:00' };
const MID_C = { start: '2026-12-18 13:00:00', end: '2026-12-18 16:00:00' };
const FINAL_A = { start: '2027-02-22 09:00:00', end: '2027-02-22 12:00:00' };

function entry(
  teachTableId: string,
  subjectId: string,
  exam: Exam,
  section = '901',
): PlanEntry {
  return makePlanEntry({
    snapshot: makeSnapshot({
      ...makeSection({ teachTableId, subjectId, section, exam }),
      subjectMeta: {
        subjectId,
        nameTh: `วิชา ${subjectId}`,
        nameEn: `Subject ${subjectId}`,
        credit: 3,
        creditStr: '3(3-0-6)',
      },
    }),
  });
}

function renderPanel(entries: PlanEntry[], locale: Locale = 'th') {
  return render(
    <ExamSchedulePanel
      schedule={buildExamSchedule(entries)}
      locale={locale}
      t={createTranslator(locale)}
    />,
  );
}

afterEach(cleanup);

describe('ExamSchedulePanel', () => {
  it('groups the exams by kind and by date under weekday headers', () => {
    renderPanel([
      entry('a', '10000001', { midterm: MID_A, final: FINAL_A }),
      entry('c', '10000003', { midterm: MID_C }),
    ]);
    const panel = screen.getByRole('region', { name: 'ตารางสอบ' });
    const kinds = within(panel)
      .getAllByRole('heading', { level: 4 })
      .map((heading) => heading.textContent);
    expect(kinds).toEqual(['สอบกลางภาค', 'สอบปลายภาค']);

    const midterm = screen.getByRole('region', { name: 'สอบกลางภาค' });
    expect(
      within(midterm)
        .getAllByRole('heading', { level: 5 })
        .map((heading) => heading.textContent),
    ).toEqual(['วันพฤหัสบดี 17 ธ.ค. 2569', 'วันศุกร์ 18 ธ.ค. 2569']);
    expect(within(midterm).getByText('09:00-12:00')).toBeVisible();
    expect(within(midterm).getByText('วิชา 10000001')).toBeVisible();
    expect(within(midterm).getAllByText('กลุ่มเรียน 901')).toHaveLength(2);

    const final = screen.getByRole('region', { name: 'สอบปลายภาค' });
    expect(within(final).getByRole('heading', { level: 5 })).toHaveTextContent(
      'วันจันทร์ 22 ก.พ. 2570',
    );
  });

  it('marks an overlap with a danger edge and names the other subject', () => {
    const { container } = renderPanel([
      entry('a', '10000001', { midterm: MID_A }),
      entry('b', '10000002', { midterm: MID_B }, '902'),
      entry('c', '10000003', { midterm: MID_C }),
    ]);
    expect(
      screen.getByText('สอบชนกับ 10000002 วิชา 10000002 กลุ่มเรียน 902'),
    ).toBeVisible();
    expect(
      screen.getByText('สอบชนกับ 10000001 วิชา 10000001 กลุ่มเรียน 901'),
    ).toBeVisible();
    const clashed = container.querySelectorAll('[data-exam-clash]');
    expect(clashed).toHaveLength(2);
    for (const row of clashed) expect(row).toHaveClass('border-l-danger');
    // The lone exam on the next day sits clear.
    const lone = screen.getByText('วิชา 10000003').closest('li');
    expect(lone).toHaveClass('border-l-transparent');
  });

  it('notes a day that holds two or more subjects', () => {
    renderPanel([
      entry('a', '10000001', { midterm: MID_A }),
      entry('b', '10000002', { midterm: MID_B }),
      entry('c', '10000003', { midterm: MID_C }),
    ]);
    expect(screen.getAllByText('สอบวันเดียวกัน 2 วิชา')).toHaveLength(1);
  });

  it('lists the subjects that announce no exam date apart', () => {
    renderPanel([
      entry('a', '10000001', { midterm: MID_A }),
      entry('d', '10000004', {}),
    ]);
    const list = screen.getByRole('region', { name: 'วิชาที่จัดสอบเอง' });
    expect(within(list).getByText('วิชา 10000004')).toBeVisible();
    expect(within(list).queryByText('วิชา 10000001')).toBeNull();
  });

  it('says so when no subject announces an exam date', () => {
    renderPanel([entry('d', '10000004', {})]);
    expect(screen.getByText('ยังไม่มีวันสอบในตารางนี้')).toBeVisible();
    expect(screen.queryByRole('region', { name: 'สอบกลางภาค' })).toBeNull();
    expect(
      screen.getByRole('region', { name: 'วิชาที่จัดสอบเอง' }),
    ).toBeVisible();
  });

  it('tags a row whose review holds an exam change', () => {
    const changed = entry('a', '10000001', { midterm: MID_A });
    renderPanel([
      {
        ...changed,
        review: {
          kinds: ['exam_changed'],
          before: changed.snapshot,
          detectedAt: '2026-07-08T00:00:00.000Z',
          notifiedAt: null,
        },
      },
      entry('c', '10000003', { midterm: MID_C }),
    ]);
    expect(screen.getAllByText('เปลี่ยน')).toHaveLength(1);
    expect(screen.getByText('วิชา 10000001').closest('p')).toHaveTextContent(
      'เปลี่ยน',
    );
  });

  it('shows the exam detail text and the English copy', () => {
    renderPanel(
      [
        entry('a', '10000001', { midterm: MID_A, note: 'Room 401' }),
        entry('b', '10000002', { midterm: MID_B }),
      ],
      'en',
    );
    expect(screen.getByRole('region', { name: 'Exam schedule' })).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Thursday 17 Dec 2569' }),
    ).toBeVisible();
    expect(screen.getByText('Room 401')).toBeVisible();
    expect(screen.getByText('2 exams on this day')).toBeVisible();
    expect(
      screen.getByText('Clashes with 10000002 Subject 10000002 section 901'),
    ).toBeVisible();
  });

  it('falls back to the Thai name when a subject has no English name', () => {
    const blank = entry('a', '10000001', { midterm: MID_A });
    renderPanel(
      [
        {
          ...blank,
          snapshot: {
            ...blank.snapshot,
            subjectMeta: { ...blank.snapshot.subjectMeta, nameEn: '' },
          },
        },
        entry('b', '10000002', { midterm: MID_B }),
      ],
      'en',
    );
    expect(screen.getByText('วิชา 10000001')).toBeVisible();
    expect(
      screen.getByText('Clashes with 10000001 วิชา 10000001 section 901'),
    ).toBeVisible();
  });
});
