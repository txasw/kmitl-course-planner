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
    rulesTh: '',
    rulesEn: '',
    remark: '',
    verifyStatus: 'unverified',
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
    rulesTh: '',
    rulesEn: '',
    remark: '',
    verifyStatus: 'unverified',
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

  it('carries the locale itself, since the export clones it without ancestors', () => {
    render(
      <PosterHeader
        planName="Plan"
        term={null}
        sections={sections}
        locale="en"
        t={createTranslator('en')}
        now={new Date('2026-07-08T00:00:00Z')}
      />,
    );
    expect(screen.getByRole('banner')).toHaveAttribute('lang', 'en');
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
