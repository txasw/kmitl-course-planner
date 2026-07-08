import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import { GridFooter } from './GridFooter';
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
  teachTableId: 'o1',
  subjectId: '90000002',
  section: '1',
  nameTh: 'ข',
  nameEn: 'B',
  credit: 2,
  kind: 'lecture',
  meetings: [],
};

afterEach(cleanup);

describe('GridFooter', () => {
  it('totals credits including unscheduled sections and counts subjects', () => {
    render(<GridFooter sections={[scheduled, online]} t={t} />);
    expect(screen.getByText('5 หน่วยกิต')).toBeInTheDocument();
    expect(screen.getByText('2 วิชา')).toBeInTheDocument();
  });

  it('shows the scheduled load per day and the unscheduled count', () => {
    render(<GridFooter sections={[scheduled, online]} t={t} />);
    expect(screen.getByText('จ 3ชม.')).toBeInTheDocument();
    expect(screen.getByText('1 ไม่มีคาบเรียน')).toBeInTheDocument();
  });

  it('omits the unscheduled count when every section is scheduled', () => {
    render(<GridFooter sections={[scheduled]} t={t} />);
    expect(screen.queryByText(/ไม่มีคาบเรียน/)).not.toBeInTheDocument();
  });
});
