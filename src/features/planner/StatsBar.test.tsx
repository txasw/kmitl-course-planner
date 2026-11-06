import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import type { Meeting } from '@/lib/domain/types';
import { WORKING_DAYS } from '@/lib/planner/freePeriods';
import { StatsBar } from './StatsBar';
import type { PlacedSection } from './placedSection';

const t = createTranslator('th');

const scheduled: PlacedSection = {
  teachTableId: 's1',
  subjectId: '90000001',
  section: '901',
  nameTh: 'ก',
  nameEn: 'A',
  credit: 3,
  kind: 'lecture',
  rulesTh: '',
  rulesEn: '',
  remark: '',
  verifyStatus: 'unverified',
  meetings: [
    {
      day: 1,
      startMin: 540,
      endMin: 720,
      room: '',
      building: '',
      kind: 'lecture',
    },
  ],
};

const online: PlacedSection = {
  ...scheduled,
  teachTableId: 'o1',
  subjectId: '90000002',
  section: '1',
  credit: 2,
  meetings: [],
};

function renderBar(
  sections: PlacedSection[],
  conflictCount = 0,
  onShowConflict = vi.fn(),
) {
  return render(
    <StatsBar
      sections={sections}
      conflictCount={conflictCount}
      onShowConflict={onShowConflict}
      t={t}
    />,
  );
}

afterEach(cleanup);

describe('StatsBar', () => {
  it('is a group named for the plan summary', () => {
    renderBar([scheduled]);
    expect(
      screen.getByRole('group', { name: 'สรุปตาราง' }),
    ).toBeInTheDocument();
  });

  it('leads with the credit total, unscheduled sections included, and counts subjects', () => {
    renderBar([scheduled, online]);
    const credits = screen.getByText('5');
    expect(credits).toHaveClass('text-base', 'font-semibold', 'tabular-nums');
    expect(credits.parentElement).toHaveTextContent('5 หน่วยกิต');
    expect(screen.getByText('2').parentElement).toHaveTextContent('2 วิชา');
  });

  it('says quietly that nothing clashes, with no control to press', () => {
    renderBar([scheduled]);
    expect(screen.getByText('ไม่มีรายการชนกัน')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('turns the clash count into a danger button that shows the first clash', () => {
    const onShowConflict = vi.fn();
    renderBar([scheduled], 2, onShowConflict);
    const button = screen.getByRole('button', { name: 'ชนกัน 2 รายการ' });
    expect(button).toHaveClass('text-danger', 'border-danger');
    fireEvent.click(button);
    expect(onShowConflict).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('ไม่มีรายการชนกัน')).not.toBeInTheDocument();
  });

  it('reads the full day name of a day load to assistive technology', () => {
    renderBar([scheduled]);
    expect(screen.getByText('จ')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('วันจันทร์')).toHaveClass('sr-only');
    expect(screen.getByText('จ').parentElement).toHaveTextContent(/3ชม\.$/);
  });

  it('counts the sections with no meeting only when there are some', () => {
    renderBar([scheduled, online]);
    expect(screen.getByText('1 ไม่มีคาบเรียน')).toBeInTheDocument();
    cleanup();
    renderBar([scheduled]);
    expect(screen.queryByText(/ไม่มีคาบเรียน/)).not.toBeInTheDocument();
  });

  it('names the free weekdays, short on screen and in full to assistive technology', () => {
    renderBar([scheduled]);
    expect(screen.getByText('วันว่าง อ พ พฤ ศ')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(
      screen.getByText('วันว่าง วันอังคาร วันพุธ วันพฤหัสบดี วันศุกร์'),
    ).toHaveClass('sr-only');
  });

  it('leaves the free days out when every weekday has a class', () => {
    const meetings = WORKING_DAYS.map<Meeting>((day) => ({
      day,
      startMin: 540,
      endMin: 720,
      room: '',
      building: '',
      kind: 'lecture',
    }));
    renderBar([{ ...scheduled, meetings }]);
    expect(screen.queryByText(/วันว่าง/)).not.toBeInTheDocument();
  });

  it('reads the free days in English', () => {
    render(
      <StatsBar
        sections={[scheduled]}
        conflictCount={0}
        onShowConflict={vi.fn()}
        t={createTranslator('en')}
      />,
    );
    expect(screen.getByText('Free days Tue Wed Thu Fri')).toBeInTheDocument();
    expect(
      screen.getByText('Free days Tuesday Wednesday Thursday Friday'),
    ).toHaveClass('sr-only');
  });
});
