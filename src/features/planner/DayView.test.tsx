import { describe, it, expect, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import type { DayOfWeek } from '@/lib/parsing/days';
import { dayChipDays, dayFlags } from '@/lib/planner/dayView';
import { planConflicts } from '@/lib/planner/planConflicts';
import {
  makeMeeting,
  makeSection,
} from '../../../tests/support/domain-builders';
import { DayChips } from './DayChips';

const t = createTranslator('th');

afterEach(cleanup);

// Monday has a time conflict between two sections, Wednesday a single class, and
// Saturday a class, so the row offers the week plus Saturday.
const conflicting = [
  makeSection({
    teachTableId: 'a',
    subjectId: '90000001',
    meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 660 })],
  }),
  makeSection({
    teachTableId: 'b',
    subjectId: '90000002',
    meetings: [
      makeMeeting({ day: 1, startMin: 600, endMin: 720 }),
      makeMeeting({ day: 3, startMin: 540, endMin: 600 }),
      makeMeeting({ day: 6, startMin: 540, endMin: 600 }),
    ],
  }),
];
const meetings = conflicting.flatMap((section) => section.meetings);
const flags = dayFlags(meetings, planConflicts(conflicting));
const days = dayChipDays(meetings);

function ChipsHarness({ initial }: { initial: DayOfWeek }) {
  const [day, setDay] = useState<DayOfWeek>(initial);
  return (
    <DayChips
      days={days}
      selected={day}
      flags={flags}
      onSelect={setDay}
      t={t}
    />
  );
}

function chip(name: string): HTMLElement {
  return screen.getByRole('radio', { name });
}

describe('DayChips', () => {
  it('names the group and each chip by its full day name and state', () => {
    render(<ChipsHarness initial={3} />);
    expect(
      screen.getByRole('radiogroup', { name: 'วันที่แสดง' }),
    ).toBeVisible();
    expect(chip('วันจันทร์ มีรายการชนกัน')).toBeVisible();
    expect(chip('วันอังคาร')).toBeVisible();
    expect(chip('วันพุธ มีเรียน')).toBeVisible();
    expect(chip('วันเสาร์ มีเรียน')).toBeVisible();
    // Sunday carries no meeting, so the row never offers it.
    expect(screen.queryByRole('radio', { name: /วันอาทิตย์/ })).toBeNull();
    expect(
      screen.getAllByRole('radio').map((node) => node.dataset.day),
    ).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  it('marks class days and conflicts with hidden dots', () => {
    render(<ChipsHarness initial={3} />);
    const dot = (name: string) =>
      chip(name).querySelector('[data-day-dot]')?.getAttribute('data-day-dot');
    expect(dot('วันจันทร์ มีรายการชนกัน')).toBe('conflict');
    expect(dot('วันพุธ มีเรียน')).toBe('class');
    expect(dot('วันอังคาร')).toBe('none');
    expect(
      chip('วันพุธ มีเรียน').querySelector('[data-day-dot]'),
    ).toHaveAttribute('aria-hidden', 'true');
  });

  it('checks the shown day and keeps only it in the tab order', () => {
    render(<ChipsHarness initial={3} />);
    expect(chip('วันพุธ มีเรียน')).toHaveAttribute('aria-checked', 'true');
    expect(chip('วันพุธ มีเรียน')).toHaveAttribute('tabindex', '0');
    expect(chip('วันอังคาร')).toHaveAttribute('aria-checked', 'false');
    expect(chip('วันอังคาร')).toHaveAttribute('tabindex', '-1');
  });

  it('selects a day on click', () => {
    render(<ChipsHarness initial={3} />);
    fireEvent.click(chip('วันอังคาร'));
    expect(chip('วันอังคาร')).toHaveAttribute('aria-checked', 'true');
  });

  it('moves the choice and focus with the arrow keys, wrapping at the ends', () => {
    render(<ChipsHarness initial={6} />);
    fireEvent.keyDown(chip('วันเสาร์ มีเรียน'), { key: 'ArrowRight' });
    expect(chip('วันจันทร์ มีรายการชนกัน')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(chip('วันจันทร์ มีรายการชนกัน')).toHaveFocus();
    fireEvent.keyDown(chip('วันจันทร์ มีรายการชนกัน'), { key: 'ArrowLeft' });
    expect(chip('วันเสาร์ มีเรียน')).toHaveFocus();
    fireEvent.keyDown(chip('วันเสาร์ มีเรียน'), { key: 'Home' });
    expect(chip('วันจันทร์ มีรายการชนกัน')).toHaveFocus();
    fireEvent.keyDown(chip('วันจันทร์ มีรายการชนกัน'), { key: 'End' });
    expect(chip('วันเสาร์ มีเรียน')).toHaveAttribute('aria-checked', 'true');
  });
});
