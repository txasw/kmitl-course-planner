import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
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
});
