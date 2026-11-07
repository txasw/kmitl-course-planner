import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import { DEFAULT_WINDOW } from '@/lib/planner/grid';
import { WEEK_DAYS } from '@/lib/parsing/days';
import {
  makePlanEntry,
  makeSection,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import {
  DEFAULT_DISPLAY_OPTIONS,
  type DisplayOptions,
} from '@/lib/planner/displayOptions';
import {
  buildExamSchedule,
  type ExamSchedule,
} from '@/lib/planner/examSchedule';
import { DEFAULT_TEMPLATE } from '@/lib/planner/exportTemplates';
import type { PosterHonesty } from '@/lib/planner/posterHonesty';
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
  rulesTh: '',
  rulesEn: '',
  remark: '',
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

const online: PlacedSection = {
  ...section,
  teachTableId: 't2',
  subjectId: '90000002',
  nameTh: 'วิชาออนไลน์',
  verifyStatus: 'missing',
  meetings: [],
};

const CLEAN: PosterHonesty = {
  dataDate: { kind: 'unverified' },
  missingCount: 0,
  conflictPairCount: 0,
};

interface PosterInputs {
  scheduled?: PlacedSection[];
  unscheduled?: PlacedSection[];
  honesty?: PosterHonesty;
  displayOptions?: DisplayOptions;
  examSchedule?: ExamSchedule;
}

function renderPoster({
  scheduled = [section],
  unscheduled = [],
  honesty = CLEAN,
  displayOptions = DEFAULT_DISPLAY_OPTIONS,
  examSchedule = buildExamSchedule([]),
}: PosterInputs = {}) {
  return render(
    <PreviewPoster
      template={DEFAULT_TEMPLATE}
      planName="ตาราง 1"
      term={{ year: '2569', semester: '1' }}
      sections={[...scheduled, ...unscheduled]}
      scheduled={scheduled}
      unscheduled={unscheduled}
      window={DEFAULT_WINDOW}
      days={WEEK_DAYS}
      displayOptions={displayOptions}
      honesty={honesty}
      examSchedule={examSchedule}
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

  it('scopes the poster leading so the pinned panel scale leaves the export geometry alone', () => {
    const { container } = renderPoster();
    expect(footerRow(container).closest('.kcp-poster')).not.toBeNull();
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
      screen.getByText('สร้างโดย KCP: ตัววางแผนตารางเรียน สจล.'),
    ).toBeInTheDocument();
  });
});

describe('PreviewPoster verification marks', () => {
  it('draws no badge on a missing or changed block or on a missing shelf row', () => {
    const { container } = renderPoster({
      scheduled: [
        { ...section, verifyStatus: 'missing' },
        {
          ...section,
          teachTableId: 't3',
          subjectId: '90000003',
          verifyStatus: 'changed',
        },
      ],
      unscheduled: [online],
    });
    expect(container.querySelector('[data-verify]')).toBeNull();
    expect(container.querySelector('.kcp-hatch')).toBeNull();
    expect(screen.queryByText(/ไม่พบในระบบแล้ว/)).not.toBeInTheDocument();
    // The shelf still lists the row, so the credits it carries stay in the image.
    expect(screen.getByText('วิชาออนไลน์')).toBeInTheDocument();
  });
});

function dataLine(container: HTMLElement): HTMLElement {
  const line = container.querySelector('[data-poster-data-line]');
  if (!(line instanceof HTMLElement)) {
    throw new Error('expected the poster data line');
  }
  return line;
}

describe('PreviewPoster data line', () => {
  it('dates the poster from the oldest check, beside the watermark in the footer row', () => {
    const at = new Date(2026, 10, 6, 8, 5).toISOString();
    const { container } = renderPoster({
      honesty: { ...CLEAN, dataDate: { kind: 'asOf', at } },
    });
    const line = dataLine(container);
    expect(line).toHaveTextContent('ข้อมูล ณ 6 พ.ย. 2569 08:05');
    expect(line.closest('[data-poster-footer]')).toBe(footerRow(container));
    // A clean plan carries the date line alone.
    expect(line.children).toHaveLength(1);
  });

  it('says nothing has been checked when no entry has a verification date', () => {
    const { container } = renderPoster();
    expect(dataLine(container)).toHaveTextContent('ยังไม่ได้ตรวจสอบข้อมูล');
  });

  it('adds a second line with the missing and conflicting pair counts', () => {
    const { container } = renderPoster({
      honesty: { ...CLEAN, missingCount: 2, conflictPairCount: 1 },
    });
    const line = dataLine(container);
    expect(line.children).toHaveLength(2);
    expect(
      within(line).getByText('2 รายวิชาไม่พบในระบบ ณ วันที่ตรวจสอบ'),
    ).toBeInTheDocument();
    expect(
      within(line).getByText('มีรายวิชาที่เวลาชนกัน 1 คู่'),
    ).toBeInTheDocument();
  });

  it('states only the count that applies', () => {
    const { container } = renderPoster({
      honesty: { ...CLEAN, conflictPairCount: 3 },
    });
    const line = dataLine(container);
    expect(
      within(line).getByText('มีรายวิชาที่เวลาชนกัน 3 คู่'),
    ).toBeInTheDocument();
    expect(line).not.toHaveTextContent('ไม่พบในระบบ');
  });

  it('carries no data line on an empty plan', () => {
    const { container } = renderPoster({ scheduled: [] });
    expect(container.querySelector('[data-poster-data-line]')).toBeNull();
    expect(container.querySelector('[data-poster-watermark]')).not.toBeNull();
  });
});

function examEntry(teachTableId: string, subjectId: string, day: number) {
  const date = `2026-12-${String(day).padStart(2, '0')}`;
  return makePlanEntry({
    snapshot: makeSnapshot({
      ...makeSection({
        teachTableId,
        subjectId,
        section: '1',
        exam: {
          midterm: { start: `${date} 09:00:00`, end: `${date} 12:00:00` },
        },
      }),
      subjectMeta: {
        subjectId,
        nameTh: `วิชา ${subjectId}`,
        nameEn: `Subject ${subjectId}`,
        credit: 3,
        creditStr: '3(3-0-6)',
      },
    }),
  });
}

const EXAMS = buildExamSchedule([
  examEntry('e1', '90000011', 10),
  examEntry('e2', '90000012', 11),
  examEntry('e3', '90000013', 12),
  examEntry('e4', '90000014', 13),
  makePlanEntry(),
]);

const SHOW_EXAMS: DisplayOptions = {
  ...DEFAULT_DISPLAY_OPTIONS,
  showEnglishNames: false,
  showExams: true,
};

function queryExamBlock(container: HTMLElement): HTMLElement | null {
  const block = container.querySelector('[data-poster-exams]');
  return block instanceof HTMLElement ? block : null;
}

function examBlock(container: HTMLElement): HTMLElement {
  const block = queryExamBlock(container);
  if (block === null) {
    throw new Error('expected the poster exam block');
  }
  return block;
}

describe('PreviewPoster exam schedule', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('leaves the poster a class timetable while the option is off', () => {
    const { container } = renderPoster({ examSchedule: EXAMS });
    expect(queryExamBlock(container)).toBeNull();
  });

  it('lists the exams below the shelf and above the footer when the option is on', () => {
    const { container } = renderPoster({
      unscheduled: [online],
      displayOptions: SHOW_EXAMS,
      examSchedule: EXAMS,
    });
    const block = examBlock(container);
    expect(within(block).getByRole('heading')).toHaveTextContent('ตารางสอบ');
    const rows = within(block).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      'กลางภาค 10 ธ.ค. 2569 09:00-12:00 วิชา 90000011 (1)',
      'กลางภาค 11 ธ.ค. 2569 09:00-12:00 วิชา 90000012 (1)',
      'กลางภาค 12 ธ.ค. 2569 09:00-12:00 วิชา 90000013 (1)',
      'กลางภาค 13 ธ.ค. 2569 09:00-12:00 วิชา 90000014 (1)',
      'จัดสอบเอง วิชา (901)',
    ]);
    const shelf = screen.getByRole('region', {
      name: 'รายวิชาที่ไม่มีคาบเรียน',
    });
    const order = (a: Node, b: Node) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING;
    expect(order(shelf, block)).toBeTruthy();
    expect(order(block, footerRow(container))).toBeTruthy();
  });

  it('draws the block in ink only, with no danger or warn colour', () => {
    const { container } = renderPoster({
      displayOptions: SHOW_EXAMS,
      examSchedule: EXAMS,
    });
    const block = examBlock(container);
    const classes = [block, ...block.querySelectorAll('*')].map((el) =>
      el.getAttribute('class'),
    );
    expect(classes.join(' ')).not.toMatch(/danger|warn/);
  });

  it('caps the block at a quarter of the template height', () => {
    const { container } = renderPoster({
      displayOptions: SHOW_EXAMS,
      examSchedule: EXAMS,
    });
    expect(examBlock(container).style.maxHeight).toBe('135px');
  });

  it('is absent when the plan has no subjects', () => {
    const { container } = renderPoster({
      scheduled: [],
      displayOptions: SHOW_EXAMS,
      examSchedule: buildExamSchedule([]),
    });
    expect(queryExamBlock(container)).toBeNull();
  });

  it('drops whole rows from the end and counts them when the rows overflow the cap', () => {
    // jsdom performs no layout, so model the block as a 100 px box whose content is a 30 px
    // heading plus 20 px per row and per closing count line.
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(
      function (this: HTMLElement) {
        if (!this.hasAttribute('data-poster-exams')) {
          return 100;
        }
        const rows = this.querySelectorAll('li, p').length;
        return 30 + rows * 20;
      },
    );
    const { container } = renderPoster({
      displayOptions: SHOW_EXAMS,
      examSchedule: EXAMS,
    });
    const block = examBlock(container);
    const rows = within(block).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      'กลางภาค 10 ธ.ค. 2569 09:00-12:00 วิชา 90000011 (1)',
      'กลางภาค 11 ธ.ค. 2569 09:00-12:00 วิชา 90000012 (1)',
    ]);
    expect(within(block).getByText('อีก 3 รายการ')).toBeInTheDocument();
  });
});
