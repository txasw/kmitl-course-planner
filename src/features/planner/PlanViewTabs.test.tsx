import { describe, it, expect, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import type { PlanView } from '@/features/shell/uiStore';
import { PlanViewTabs, planViewPanelId } from './PlanViewTabs';

const t = createTranslator('th');

function Harness({
  initial = 'timetable',
  examClash = false,
}: {
  initial?: PlanView;
  examClash?: boolean;
}) {
  const [view, setView] = useState<PlanView>(initial);
  return (
    <PlanViewTabs
      value={view}
      selectedCount={3}
      examClash={examClash}
      onChange={setView}
      t={t}
    />
  );
}

function tab(name: string): HTMLElement {
  return screen.getByRole('tab', { name });
}

afterEach(cleanup);

describe('PlanViewTabs', () => {
  it('names the tablist and carries the subject count in the selected tab', () => {
    render(<Harness />);
    expect(screen.getByRole('tablist', { name: 'มุมมองตาราง' })).toBeVisible();
    expect(tab('ตารางเรียน')).toBeVisible();
    expect(tab('วิชาที่เลือก (3)')).toBeVisible();
    expect(tab('สรุป')).toBeVisible();
  });

  it('marks an exam clash on the summary tab with a dot and in its name', () => {
    const { container } = render(<Harness examClash />);
    expect(tab('สรุป มีวิชาที่สอบชนกัน')).toBeVisible();
    expect(container.querySelectorAll('.bg-danger')).toHaveLength(1);
  });

  it('shows no dot without an exam clash', () => {
    const { container } = render(<Harness />);
    expect(tab('สรุป')).toBeVisible();
    expect(container.querySelector('.bg-danger')).toBeNull();
  });

  it('marks the active tab and keeps only it in the tab order', () => {
    render(<Harness />);
    expect(tab('ตารางเรียน')).toHaveAttribute('aria-selected', 'true');
    expect(tab('ตารางเรียน')).toHaveAttribute('tabindex', '0');
    expect(tab('วิชาที่เลือก (3)')).toHaveAttribute('aria-selected', 'false');
    expect(tab('วิชาที่เลือก (3)')).toHaveAttribute('tabindex', '-1');
    expect(tab('วิชาที่เลือก (3)')).toHaveAttribute(
      'aria-controls',
      planViewPanelId('selected'),
    );
  });

  it('switches the view on click', () => {
    render(<Harness />);
    fireEvent.click(tab('วิชาที่เลือก (3)'));
    expect(tab('วิชาที่เลือก (3)')).toHaveAttribute('aria-selected', 'true');
    expect(tab('ตารางเรียน')).toHaveAttribute('aria-selected', 'false');
  });

  it('moves focus and activates with the arrow keys, wrapping at the ends', () => {
    render(<Harness />);
    const timetable = tab('ตารางเรียน');
    const selected = tab('วิชาที่เลือก (3)');
    const summary = tab('สรุป');
    timetable.focus();

    fireEvent.keyDown(timetable, { key: 'ArrowRight' });
    expect(selected).toHaveFocus();
    expect(selected).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(selected, { key: 'ArrowRight' });
    expect(summary).toHaveFocus();
    expect(summary).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(summary, { key: 'ArrowRight' });
    expect(timetable).toHaveFocus();
    expect(timetable).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(timetable, { key: 'ArrowLeft' });
    expect(summary).toHaveFocus();
    expect(summary).toHaveAttribute('aria-selected', 'true');
  });

  it('moves to the first and last tab with Home and End', () => {
    render(<Harness />);
    const timetable = tab('ตารางเรียน');
    const summary = tab('สรุป');
    timetable.focus();

    fireEvent.keyDown(timetable, { key: 'End' });
    expect(summary).toHaveFocus();
    fireEvent.keyDown(summary, { key: 'Home' });
    expect(timetable).toHaveFocus();
    expect(timetable).toHaveAttribute('aria-selected', 'true');
  });

  it('ignores other keys', () => {
    render(<Harness />);
    const timetable = tab('ตารางเรียน');
    timetable.focus();
    fireEvent.keyDown(timetable, { key: 'ArrowDown' });
    expect(timetable).toHaveFocus();
    expect(timetable).toHaveAttribute('aria-selected', 'true');
  });

  it('places a trailing control in the row outside the tablist', () => {
    render(
      <PlanViewTabs
        value="timetable"
        selectedCount={3}
        examClash={false}
        onChange={() => undefined}
        t={t}
        trailing={<button type="button">indicator</button>}
      />,
    );
    const trailing = screen.getByRole('button', { name: 'indicator' });
    expect(screen.getByRole('tablist')).not.toContainElement(trailing);
    expect(screen.getByRole('tablist').parentElement).toContainElement(
      trailing,
    );
  });
});
