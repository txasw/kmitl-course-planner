import { describe, it, expect, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import type { PlanView } from '@/features/shell/uiStore';
import { PlanViewTabs, planViewPanelId } from './PlanViewTabs';

const t = createTranslator('th');

function Harness({ initial = 'timetable' }: { initial?: PlanView }) {
  const [view, setView] = useState<PlanView>(initial);
  return (
    <PlanViewTabs value={view} selectedCount={3} onChange={setView} t={t} />
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
    timetable.focus();

    fireEvent.keyDown(timetable, { key: 'ArrowRight' });
    expect(selected).toHaveFocus();
    expect(selected).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(selected, { key: 'ArrowRight' });
    expect(timetable).toHaveFocus();
    expect(timetable).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(timetable, { key: 'ArrowLeft' });
    expect(selected).toHaveFocus();
    expect(selected).toHaveAttribute('aria-selected', 'true');
  });

  it('moves to the first and last tab with Home and End', () => {
    render(<Harness />);
    const timetable = tab('ตารางเรียน');
    const selected = tab('วิชาที่เลือก (3)');
    timetable.focus();

    fireEvent.keyDown(timetable, { key: 'End' });
    expect(selected).toHaveFocus();
    fireEvent.keyDown(selected, { key: 'Home' });
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
});
