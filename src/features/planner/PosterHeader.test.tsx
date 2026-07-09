import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import { PosterHeader } from './PosterHeader';
import type { PlacedSection } from './placedSection';

const t = createTranslator('th');

const sections: PlacedSection[] = [
  {
    teachTableId: 's1',
    subjectId: '90000001',
    section: '901',
    nameTh: 'ก',
    nameEn: 'A',
    credit: 3,
    kind: 'lecture',
    meetings: [],
  },
  {
    teachTableId: 's2',
    subjectId: '90000002',
    section: '902',
    nameTh: 'ข',
    nameEn: 'B',
    credit: 2,
    kind: 'lecture',
    meetings: [],
  },
];

afterEach(cleanup);

describe('PosterHeader', () => {
  it('shows the plan name, the term, and the total credits', () => {
    render(
      <PosterHeader
        planName="ตาราง"
        term={{ year: '2569', semester: '1' }}
        sections={sections}
        locale="th"
        t={t}
        now={new Date('2026-07-08T00:00:00Z')}
      />,
    );
    expect(screen.getByRole('heading', { name: 'ตาราง' })).toBeInTheDocument();
    expect(screen.getByText('ภาคการศึกษา 1/2569')).toBeInTheDocument();
    expect(screen.getByText('5 หน่วยกิต')).toBeInTheDocument();
  });

  it('omits the term line when no term is given', () => {
    render(
      <PosterHeader
        planName="ตาราง"
        term={null}
        sections={sections}
        locale="th"
        t={t}
        now={new Date('2026-07-08T00:00:00Z')}
      />,
    );
    expect(screen.queryByText(/ภาคการศึกษา/)).toBeNull();
  });
});
