import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import { ExamLine } from './ExamLine';

const th = createTranslator('th');
const en = createTranslator('en');

const midterm = { start: '2026-08-21 09:30:00', end: '2026-08-21 12:30:00' };
const final = { start: '2026-10-30 09:30:00', end: '2026-10-30 12:30:00' };

afterEach(cleanup);

describe('ExamLine', () => {
  it('shows the midterm before the final in the Buddhist year from the stored CE year', () => {
    const { container } = render(<ExamLine exam={{ final, midterm }} t={th} />);
    // 2026 CE plus 543 is 2569 BE, the year the app displays in both locales.
    expect(container.textContent).toBe(
      'กลางภาค 21 ส.ค. 2569 09:30-12:30ปลายภาค 30 ต.ค. 2569 09:30-12:30',
    );
  });

  it('keeps the Buddhist year and localizes the labels in English', () => {
    render(<ExamLine exam={{ midterm, final }} t={en} />);
    expect(screen.getByText('Midterm').parentElement?.textContent).toBe(
      'Midterm 21 Aug 2569 09:30-12:30',
    );
    expect(screen.getByText('Final').parentElement?.textContent).toBe(
      'Final 30 Oct 2569 09:30-12:30',
    );
  });

  it('keeps each window whole so a narrow row wraps between them', () => {
    render(<ExamLine exam={{ midterm, final }} t={th} />);
    const midtermWindow = screen.getByText('กลางภาค').parentElement;
    expect(midtermWindow?.className.split(' ')).toContain('whitespace-nowrap');
  });

  it('shows only the window the section announces', () => {
    const { container } = render(<ExamLine exam={{ final }} t={th} />);
    expect(container.textContent).toBe('ปลายภาค 30 ต.ค. 2569 09:30-12:30');
    expect(screen.queryByText('จัดสอบเอง')).toBeNull();
  });

  it('reads as arranged by the instructor when both windows are absent', () => {
    render(<ExamLine exam={{}} t={th} />);
    expect(screen.getByText('จัดสอบเอง')).toBeTruthy();
    expect(screen.queryByText('กลางภาค')).toBeNull();
  });

  it('clamps the exam detail note to one line', () => {
    render(<ExamLine exam={{ note: 'สอบนอกตาราง ห้อง 301' }} t={th} />);
    expect(screen.getByText('จัดสอบเอง')).toBeTruthy();
    const note = screen.getByText('สอบนอกตาราง ห้อง 301');
    expect(note.className.split(' ')).toContain('truncate');
  });

  it('omits the note line when the detail is blank', () => {
    const { container } = render(
      <ExamLine exam={{ midterm, note: '  ' }} t={th} />,
    );
    expect(container.querySelectorAll('p')).toHaveLength(1);
  });
});
