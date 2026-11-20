import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import { suggestPlans } from '@/lib/planner/suggest';
import { byClassCourses, lockSections } from '../../../tests/support/suggest';
import type { Orientation } from './gridGeometry';
import { labelStepFor, SuggestionCard } from './SuggestionCard';
import { sharedFrame, suggestionSections } from './suggestionFrame';

const t = createTranslator('th');
const courses = byClassCourses();
// The lab and a GenEd are in the plan, the GenEd added by hand from another search so
// this result lacks it and it keeps its own section. The student unticks the lab, so
// the card leaves it out and names what clashes with the GenEd.
const entries = lockSections(courses, [
  ['01006021', '3'],
  ['04186098', '2'],
]);
const result = courses.filter((course) => course.subjectId !== '04186098');
const [suggestion] = suggestPlans({
  courses: result,
  subjects: new Set(['04186098', '01006020', '01006503', '01006030']),
  entries,
  objective: 'coverAll',
  preference: 'morning',
}).suggestions;

afterEach(() => {
  cleanup();
});

function renderCard({
  onApply = vi.fn(),
  orientation = 'landscape',
}: {
  onApply?: () => void;
  orientation?: Orientation;
} = {}) {
  if (suggestion === undefined) throw new Error('expected a suggestion');
  const sections = suggestionSections(entries, suggestion);
  render(
    <SuggestionCard
      suggestion={suggestion}
      index={0}
      sections={sections}
      frame={sharedFrame([sections])}
      orientation={orientation}
      locale="th"
      t={t}
      onApply={onApply}
    />,
  );
  return { onApply, suggestion };
}

describe('SuggestionCard', () => {
  it('names the option and states its stats', () => {
    const { suggestion: shown } = renderCard();
    expect(
      screen.getByRole('heading', { name: 'ตัวเลือกที่ 1' }),
    ).toBeInTheDocument();
    expect(screen.getByText('หน่วยกิต').nextSibling).toHaveTextContent(
      String(shown.stats.credits),
    );
    expect(screen.getByText('วิชา').nextSibling).toHaveTextContent(
      String(shown.stats.courses),
    );
    expect(screen.getByText('ช่วงว่าง').nextSibling).toHaveTextContent(/ชม\./);
  });

  it('draws the kept plan subjects and the chosen sections on a read only grid', () => {
    const { suggestion: shown } = renderCard();
    const grid = screen.getByRole('group', { name: 'ตารางเรียนรายสัปดาห์' });
    const placed = new Set(
      Array.from(
        grid.querySelectorAll<HTMLElement>('[data-teach-table-id]'),
        (block) => block.dataset.teachTableId,
      ),
    );
    expect(
      shown.choices.find((choice) => choice.current)?.course.subjectId,
    ).toBe('04186098');
    for (const choice of shown.choices) {
      expect(placed.has(choice.section.teachTableId)).toBe(true);
    }
    // The unticked lab is left out of the drawn week.
    expect(placed.has(entries[0]?.teachTableId)).toBe(false);
    expect(grid.querySelector('button')).toBeNull();
    // The card is read only but never exported, so its blocks take the soft card.
    for (const block of grid.querySelectorAll('[data-teach-table-id]')) {
      expect(block).toHaveAttribute('data-surface', 'soft');
    }
  });

  it('lists the courses left out with their reasons behind a collapsed disclosure', () => {
    const { suggestion: shown } = renderCard();
    const toggle = screen.getByRole('button', {
      name: `วิชาที่ไม่ได้จัดลงตาราง ${String(shown.leftOut.length)} วิชา`,
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('ชนกับ 04186098 ในตารางปัจจุบัน')).toBeNull();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('ชนกับ 04186098 ในตารางปัจจุบัน')).toBeInTheDocument();
  });

  it('names every placed section in full, collapsed', () => {
    const { suggestion: shown } = renderCard();
    const sections = suggestionSections(entries, shown);
    const placedSubjects = new Set(
      sections.map((section) => section.subjectId),
    );
    const toggle = screen.getByRole('button', {
      name: `วิชาในตัวเลือกนี้ ${String(placedSubjects.size)} วิชา`,
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle.querySelector('svg')).not.toBeNull();
    fireEvent.click(toggle);
    const panelId = toggle.getAttribute('aria-controls');
    const panel = document.getElementById(panelId ?? '');
    expect(panel).not.toBeNull();
    for (const section of sections) {
      expect(
        within(panel ?? document.body).getAllByText(
          `${section.subjectId} ${section.nameTh}`,
        ).length,
      ).toBeGreaterThan(0);
    }
    expect(
      within(panel ?? document.body).getAllByText(/^กลุ่มเรียน \S+ (ทฤษฎี|ปฏิบัติ)$/),
    ).toHaveLength(sections.length);
    expect(document.querySelector('details')).toBeNull();
  });

  it('applies the suggestion', () => {
    const { onApply } = renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'ใช้ตารางนี้' }));
    expect(onApply).toHaveBeenCalledOnce();
  });

  it('offers no full size view, since a slide shows the grid in place', () => {
    renderCard();
    expect(screen.queryByRole('button', { name: /ขนาดเต็ม/ })).toBeNull();
  });

  it('draws a portrait grid without the poster floor', () => {
    renderCard({ orientation: 'portrait' });
    const grid = screen.getByRole('group', { name: 'ตารางเรียนรายสัปดาห์' });
    expect(grid.style.gridTemplateColumns).toMatch(/^2\.75rem repeat\(/);
    expect(grid.className).not.toMatch(/min-h-\[44rem\]/);
  });
});

describe('labelStepFor', () => {
  it('labels every hour while each hour has room for its label', () => {
    expect(labelStepFor(436, 10)).toBe(1);
  });

  it('thins the labels as the hours narrow', () => {
    expect(labelStepFor(336, 10)).toBe(2);
    expect(labelStepFor(196, 10)).toBe(3);
  });

  it('labels every hour before the grid is measured', () => {
    expect(labelStepFor(0, 10)).toBe(1);
  });
});
