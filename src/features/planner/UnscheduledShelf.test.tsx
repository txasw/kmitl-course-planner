import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  within,
  fireEvent,
  cleanup,
} from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import { UnscheduledShelf } from './UnscheduledShelf';
import type { PlacedSection } from './placedSection';

const t = createTranslator('th');

function makePlaced(overrides: Partial<PlacedSection> = {}): PlacedSection {
  return {
    teachTableId: 'o1',
    subjectId: '01006029',
    section: '1',
    nameTh: 'วิชาออนไลน์',
    nameEn: 'Online subject',
    credit: 3,
    kind: 'practice',
    meetings: [],
    rulesTh: '',
    rulesEn: '',
    remark: '',
    verifyStatus: 'unverified',
    ...overrides,
  };
}

afterEach(cleanup);

describe('UnscheduledShelf', () => {
  it('lists an unscheduled section with its credits and practice badge', () => {
    render(<UnscheduledShelf sections={[makePlaced()]} locale="th" t={t} />);
    const shelf = screen.getByRole('region', {
      name: 'รายวิชาที่ไม่มีคาบเรียน',
    });
    expect(within(shelf).getByText('01006029')).toBeInTheDocument();
    expect(within(shelf).getByText('ปฏิบัติ')).toBeInTheDocument();
    expect(within(shelf).getByText('3 หน่วยกิต')).toBeInTheDocument();
  });

  it('shows the lecture badge and the English name in the English locale', () => {
    render(
      <UnscheduledShelf
        sections={[makePlaced({ kind: 'lecture' })]}
        locale="en"
        t={createTranslator('en')}
      />,
    );
    expect(screen.getByText('Lecture')).toBeInTheDocument();
    expect(screen.getByText(/Online subject/)).toBeInTheDocument();
  });

  it('removes a shelf row on click when a handler is given', () => {
    const onRemove = vi.fn();
    render(
      <UnscheduledShelf
        sections={[makePlaced()]}
        locale="th"
        t={t}
        onRemove={onRemove}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'นำออก' }));
    expect(onRemove).toHaveBeenCalledWith('o1');
  });

  it('shows no remove button without a handler', () => {
    render(<UnscheduledShelf sections={[makePlaced()]} locale="th" t={t} />);
    expect(
      screen.queryByRole('button', { name: 'นำออก' }),
    ).not.toBeInTheDocument();
  });

  it('hides the section code when showSection is off', () => {
    render(
      <UnscheduledShelf
        sections={[makePlaced()]}
        locale="th"
        t={t}
        showSection={false}
      />,
    );
    expect(screen.queryByText(/กลุ่มเรียน 1/)).not.toBeInTheDocument();
  });

  it('hides the subject id when showSubjectId is off', () => {
    render(
      <UnscheduledShelf
        sections={[makePlaced()]}
        locale="th"
        t={t}
        showSubjectId={false}
      />,
    );
    const shelf = screen.getByRole('region', {
      name: 'รายวิชาที่ไม่มีคาบเรียน',
    });
    expect(within(shelf).queryByText('01006029')).not.toBeInTheDocument();
    expect(within(shelf).getByText('วิชาออนไลน์')).toBeInTheDocument();
  });

  it('adds the English name under a Thai primary when showEnglishName is on', () => {
    render(
      <UnscheduledShelf
        sections={[makePlaced()]}
        locale="th"
        t={t}
        showEnglishName
      />,
    );
    const shelf = screen.getByRole('region', {
      name: 'รายวิชาที่ไม่มีคาบเรียน',
    });
    expect(within(shelf).getByText('วิชาออนไลน์')).toBeInTheDocument();
    expect(within(shelf).getByText('Online subject')).toBeInTheDocument();
  });

  it('marks each name with the language of its field', () => {
    render(
      <UnscheduledShelf
        sections={[makePlaced()]}
        locale="th"
        t={t}
        showEnglishName
      />,
    );
    expect(screen.getByText('วิชาออนไลน์')).toHaveAttribute('lang', 'th');
    expect(screen.getByText('Online subject')).toHaveAttribute('lang', 'en');
  });
});

describe('UnscheduledShelf conditions and remark', () => {
  const restricted = makePlaced({
    rulesTh: 'เฉพาะคณะวิศวกรรมศาสตร์\nเฉพาะนักศึกษาชั้นปี 1',
    rulesEn: 'Only School of Engineering\nOnly year 1 students',
    remark: 'เรียนออนไลน์ผ่าน MS Teams',
  });

  it('lists the conditions and remark on the edit mode shelf', () => {
    render(
      <UnscheduledShelf
        sections={[restricted]}
        locale="th"
        t={t}
        onRemove={vi.fn()}
        editable
      />,
    );
    expect(screen.getByText('เงื่อนไข')).toBeInTheDocument();
    expect(screen.getByText('เฉพาะคณะวิศวกรรมศาสตร์')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'ดูเงื่อนไขทั้งหมด (2)' }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('หมายเหตุ')).toBeInTheDocument();
    expect(screen.getByText('เรียนออนไลน์ผ่าน MS Teams')).toBeInTheDocument();
  });

  it('keeps the conditions and remark off the shelf when it is not editable', () => {
    // The preview poster shelf is the one the export captures, so a condition or a
    // remark there would enter every shared image and change the measured fit.
    render(<UnscheduledShelf sections={[restricted]} locale="th" t={t} />);
    expect(screen.queryByText('เงื่อนไข')).not.toBeInTheDocument();
    expect(
      screen.queryByText('เฉพาะคณะวิศวกรรมศาสตร์'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('หมายเหตุ')).not.toBeInTheDocument();
    expect(
      screen.queryByText('เรียนออนไลน์ผ่าน MS Teams'),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
