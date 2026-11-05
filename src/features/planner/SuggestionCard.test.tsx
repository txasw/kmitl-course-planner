import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import { suggestPlans } from '@/lib/planner/suggest';
import { byClassCourses, lockSections } from '../../../tests/support/suggest';
import { SuggestionCard } from './SuggestionCard';

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

function renderCard(onApply = vi.fn()) {
  if (suggestion === undefined) throw new Error('expected a suggestion');
  render(
    <ul>
      <SuggestionCard
        suggestion={suggestion}
        index={0}
        locked={locked}
        locale="th"
        t={t}
        onApply={onApply}
      />
    </ul>,
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

  it('applies the suggestion', () => {
    const { onApply } = renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'ใช้ตารางนี้' }));
    expect(onApply).toHaveBeenCalledOnce();
  });
});
