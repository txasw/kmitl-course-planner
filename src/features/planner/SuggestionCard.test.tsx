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
const locked = lockSections(courses, [
  ['01006021', '3'],
  ['04186098', '2'],
]);
const [suggestion] = suggestPlans({
  courses,
  locked,
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
  const sections = suggestionSections(locked, suggestion);
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

  it('draws the locked entries and the chosen sections on a read only grid', () => {
    const { suggestion: shown } = renderCard();
    const grid = screen.getByRole('group', { name: 'ตารางเรียนรายสัปดาห์' });
    const placed = new Set(
      Array.from(
        grid.querySelectorAll<HTMLElement>('[data-teach-table-id]'),
        (block) => block.dataset.teachTableId,
      ),
    );
    for (const entry of locked) {
      expect(placed.has(entry.teachTableId)).toBe(true);
    }
    for (const choice of shown.choices) {
      expect(placed.has(choice.section.teachTableId)).toBe(true);
    }
    expect(grid.querySelector('button')).toBeNull();
    // The card is read only but never exported, so its blocks take the soft card.
    for (const block of grid.querySelectorAll('[data-teach-table-id]')) {
      expect(block).toHaveAttribute('data-surface', 'soft');
    }
  });

  it('lists the courses left out with their reasons, collapsed', () => {
    renderCard();
    const summary = screen.getByText('วิชาที่ไม่ได้จัดลงตาราง 2 วิชา');
    expect(summary.closest('details')).not.toHaveAttribute('open');
    expect(
      screen.getByText('ชนกับ 01006021 ในตารางปัจจุบัน', {
        ignore: 'summary',
      }),
    ).toBeInTheDocument();
  });

  it('names every placed section in full, collapsed', () => {
    const { suggestion: shown } = renderCard();
    const sections = suggestionSections(locked, shown);
    const subjects = new Set(sections.map((section) => section.subjectId));
    const summary = screen.getByText(
      `วิชาในตัวเลือกนี้ ${String(subjects.size)} วิชา`,
    );
    const details = summary.closest('details');
    expect(details).not.toHaveAttribute('open');
    for (const section of sections) {
      expect(
        within(details ?? document.body).getAllByText(
          `${section.subjectId} ${section.nameTh}`,
        ).length,
      ).toBeGreaterThan(0);
    }
    expect(
      within(details ?? document.body).getAllByText(
        /^กลุ่มเรียน \S+ (ทฤษฎี|ปฏิบัติ)$/,
      ),
    ).toHaveLength(sections.length);
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
