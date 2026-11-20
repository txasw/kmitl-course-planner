import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import type { Meeting } from '@/lib/domain/types';
import { WORKING_DAYS } from '@/lib/planner/freePeriods';
import type { Semester } from '@/lib/routing/academicTerms';
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
  semester: Semester | null = null,
) {
  return render(
    <StatsBar
      sections={sections}
      semester={semester}
      conflictCount={conflictCount}
      onShowConflict={onShowConflict}
      locale="th"
      t={t}
    />,
  );
}

afterEach(cleanup);

describe('StatsBar', () => {
  it('is a group named for the plan summary', () => {
    renderBar([scheduled]);
    expect(screen.getByRole('group', { name: 'สรุปตาราง' })).toBeInTheDocument();
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
    expect(screen.getByText('จ').parentElement).toHaveTextContent(/ 3 ชม\.$/);
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
    expect(screen.getByText('วันว่าง วันอังคาร วันพุธ วันพฤหัสบดี วันศุกร์')).toHaveClass(
      'sr-only',
    );
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
        semester={null}
        conflictCount={0}
        onShowConflict={vi.fn()}
        locale="en"
        t={createTranslator('en')}
      />,
    );
    expect(screen.getByText('Mon').parentElement).toHaveTextContent(/ 3h$/);
    expect(screen.getByText('Free days Tue Wed Thu Fri')).toBeInTheDocument();
    expect(
      screen.getByText('Free days Tuesday Wednesday Thursday Friday'),
    ).toHaveClass('sr-only');
  });

  describe('status row', () => {
    function renderRow(compact: boolean, sections = [scheduled]) {
      return render(
        <StatsBar
          sections={sections}
          semester={null}
          conflictCount={0}
          onShowConflict={vi.fn()}
          status={<span>สถานะ</span>}
          action={<button type="button">แนะนำตาราง</button>}
          compact={compact}
          locale="th"
          t={t}
        />,
      );
    }

    it('leads each count with an icon', () => {
      renderRow(false, [scheduled, online]);
      const credits = screen.getByText('5').closest('span.inline-flex');
      expect(credits?.querySelector('svg')).toHaveAttribute(
        'aria-hidden',
        'true',
      );
      const subjects = screen.getByText('2').closest('span.inline-flex');
      expect(subjects?.querySelector('svg')).toHaveAttribute(
        'aria-hidden',
        'true',
      );
      const unscheduled = screen
        .getByText('1 ไม่มีคาบเรียน')
        .closest('span.inline-flex');
      expect(unscheduled?.querySelector('svg')).toHaveAttribute(
        'aria-hidden',
        'true',
      );
    });

    it('ends the row with the action, outside the wrapping facts', () => {
      renderRow(false);
      const row = screen.getByRole('group', { name: 'สรุปตาราง' });
      const action = screen.getByRole('button', { name: 'แนะนำตาราง' });
      expect(row.lastElementChild).toContainElement(action);
      expect(row.firstElementChild).not.toContainElement(action);
      expect(row.firstElementChild).toHaveClass('flex-wrap');
    });

    it('keeps the day loads and the free days from 640 px', () => {
      renderRow(false);
      expect(screen.getByText('จ')).toBeInTheDocument();
      expect(screen.getByText('วันว่าง อ พ พฤ ศ')).toBeInTheDocument();
      expect(screen.getByText('ไม่มีรายการชนกัน')).not.toHaveClass('sr-only');
    });

    it('stays slim on a phone: no day loads or free days, and the clear state in a short word', () => {
      renderRow(true, [scheduled, online]);
      expect(screen.queryByText('จ')).toBeNull();
      expect(screen.queryByText(/วันว่าง/)).toBeNull();
      // A touch user reads the short word beside the shield, since a tooltip never shows on
      // touch, and assistive technology keeps the full words.
      const clearState = document.querySelector('[data-no-conflicts]');
      expect(clearState).not.toHaveAttribute('title');
      expect(screen.getByText('ไม่ชน')).not.toHaveClass('sr-only');
      expect(screen.getByText('ไม่ชน')).toHaveAttribute('aria-hidden');
      expect(screen.getByText('ไม่มีรายการชนกัน')).toHaveClass('sr-only');
      // A shield, so the bare glyph never reads as the verified check beside it.
      const clear = document.querySelector('[data-no-conflicts] svg');
      expect(clear).toHaveClass('lucide-shield-check');
      expect(clear).not.toHaveClass('lucide-circle-check');
      // The credits, the subjects, the unscheduled count, and the status still show.
      expect(screen.getByText('5').parentElement).toHaveTextContent('5 หน่วยกิต');
      expect(screen.getByText('1 ไม่มีคาบเรียน')).toBeInTheDocument();
      expect(screen.getByText('สถานะ')).toBeInTheDocument();
    });

    it('keeps the clash button in words on a phone', () => {
      render(
        <StatsBar
          sections={[scheduled]}
          semester={null}
          conflictCount={2}
          onShowConflict={vi.fn()}
          compact
          locale="th"
          t={t}
        />,
      );
      expect(
        screen.getByRole('button', { name: 'ชนกัน 2 รายการ' }),
      ).toBeVisible();
    });

    it('holds the action alone while the plan is empty', () => {
      renderRow(true, []);
      const row = screen.getByRole('group', { name: 'สรุปตาราง' });
      expect(row).not.toHaveTextContent('หน่วยกิต');
      expect(screen.getByRole('button', { name: 'แนะนำตาราง' })).toBeVisible();
    });
  });

  describe('credit load', () => {
    const withCredits = (credits: number[]): PlacedSection[] =>
      credits.map((credit, index) => ({
        ...scheduled,
        teachTableId: `c${String(index)}`,
        subjectId: `9100000${String(index)}`,
        credit,
      }));

    function renderLoad(credits: number[], semester: Semester) {
      renderBar(withCredits(credits), 0, vi.fn(), semester);
    }

    it('keeps the total in plain ink with no note at the edges of the regular load', () => {
      renderLoad([3, 3, 3], '1');
      expect(screen.getByText('9')).toHaveClass('text-ink');
      expect(screen.queryByText(/เกณฑ์/)).not.toBeInTheDocument();
      cleanup();
      renderLoad([3, 3, 3, 3, 3, 3, 4], '2');
      expect(screen.getByText('22')).toHaveClass('text-ink');
      expect(screen.queryByText(/เกณฑ์/)).not.toBeInTheDocument();
    });

    it('notes a total below 9 credits in a regular semester in warn ink', () => {
      renderLoad([3, 3, 2], '1');
      expect(screen.getByText('8')).toHaveClass('text-warn');
      expect(screen.getByText('ต่ำกว่าเกณฑ์ขั้นต่ำปกติ 9 หน่วยกิต')).toHaveClass(
        'text-warn',
      );
    });

    it('notes a total above 22 credits in a regular semester', () => {
      renderLoad([3, 3, 3, 3, 3, 3, 3, 2], '2');
      expect(screen.getByText('23')).toHaveClass('text-warn');
      expect(screen.getByText('เกินเกณฑ์ขั้นสูงปกติ 22 หน่วยกิต')).toBeInTheDocument();
    });

    it('caps the special term at 9 credits with no minimum', () => {
      renderLoad([1], '3');
      expect(screen.queryByText(/เกณฑ์/)).not.toBeInTheDocument();
      cleanup();
      renderLoad([3, 3, 3, 1], '3');
      expect(screen.getByText('เกินเกณฑ์ขั้นสูงปกติ 9 หน่วยกิต')).toBeInTheDocument();
    });

    it('warns without adding a control, so nothing is blocked', () => {
      renderLoad([3], '1');
      expect(screen.getByText('ต่ำกว่าเกณฑ์ขั้นต่ำปกติ 9 หน่วยกิต')).toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('reads the note in English', () => {
      render(
        <StatsBar
          sections={withCredits([3, 3, 3, 3, 3, 3, 3, 2])}
          semester="1"
          conflictCount={0}
          onShowConflict={vi.fn()}
          locale="en"
          t={createTranslator('en')}
        />,
      );
      expect(
        screen.getByText('Above the usual maximum of 22 credits'),
      ).toBeInTheDocument();
    });
  });
});
