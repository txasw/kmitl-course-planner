import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import { DEFAULT_WINDOW } from '@/lib/planner/grid';
import { WEEK_DAYS } from '@/lib/parsing/days';
import { DEFAULT_DISPLAY_OPTIONS } from '@/lib/planner/displayOptions';
import { DEFAULT_TEMPLATE } from '@/lib/planner/exportTemplates';
import { PreviewPoster } from './PreviewPoster';
import type { PlacedSection } from './placedSection';

const t = createTranslator('th');

const section: PlacedSection = {
  teachTableId: 't1',
  subjectId: '90000001',
  section: '901',
  nameTh: 'วิชาทดสอบ',
  nameEn: 'Test subject',
  credit: 3,
  kind: 'lecture',
  verifyStatus: 'unverified',
  meetings: [
    {
      day: 1,
      startMin: 540,
      endMin: 660,
      room: 'A',
      building: 'A',
      kind: 'lecture',
    },
  ],
};

function renderPoster() {
  return render(
    <PreviewPoster
      template={DEFAULT_TEMPLATE}
      planName="ตาราง 1"
      term={{ year: '2569', semester: '1' }}
      sections={[section]}
      scheduled={[section]}
      unscheduled={[]}
      window={DEFAULT_WINDOW}
      days={WEEK_DAYS}
      displayOptions={DEFAULT_DISPLAY_OPTIONS}
      conflictIds={new Set()}
      examConflictIds={new Set()}
      examOverlaps={new Map()}
      locale="th"
      t={t}
    />,
  );
}

function footerRow(container: HTMLElement): HTMLElement {
  const row = container.querySelector('[data-poster-footer]');
  if (!(row instanceof HTMLElement)) {
    throw new Error('expected the poster footer row');
  }
  return row;
}

afterEach(cleanup);

describe('PreviewPoster footer', () => {
  it('puts the credits summary and the watermark on one shared baseline row', () => {
    const { container } = renderPoster();
    const row = footerRow(container);
    // One row, shared baseline, credits pushed left and watermark right, with the divider.
    expect(row.className).toContain('items-baseline');
    expect(row.className).toContain('justify-between');
    expect(row.className).toContain('border-t');
    // Both live in that row.
    expect(
      within(row).getByRole('group', { name: 'สรุปตารางเรียน' }),
    ).toBeInTheDocument();
    expect(row.querySelector('[data-poster-watermark]')).not.toBeNull();
  });

  it('drops the footer summary own divider so only the shared row carries it', () => {
    const { container } = renderPoster();
    const summary = within(footerRow(container)).getByRole('group', {
      name: 'สรุปตารางเรียน',
    });
    expect(summary.className).not.toContain('border-t');
  });

  it('sits inside the poster equal margins, so left and right margins match', () => {
    const { container } = renderPoster();
    // The poster root carries equal padding on every side, so the footer row spans between an
    // equal left and right margin whatever the template.
    expect(footerRow(container).closest('.p-3')).not.toBeNull();
  });

  it('draws the watermark from the extension brand mark and the credit text', () => {
    renderPoster();
    const watermark = document.querySelector('[data-poster-watermark]');
    expect(watermark).not.toBeNull();
    // The mark is the icon tile, not four detached squares: a rounded container with the
    // signature accent square at reduced opacity. BrandMark.test covers the full geometry.
    const svg = watermark?.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.querySelector('rect[rx="28"]')).not.toBeNull();
    expect(svg?.querySelector('rect[opacity="0.45"]')).not.toBeNull();
    expect(
      screen.getByText('สร้างโดยตัววางแผนตารางเรียน สจล.'),
    ).toBeInTheDocument();
  });
});
