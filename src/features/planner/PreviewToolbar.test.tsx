import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  act,
  within,
} from '@testing-library/react';
import type { RefObject } from 'react';
import {
  DEFAULT_DISPLAY_OPTIONS,
  type DisplayOptions,
} from '@/lib/planner/displayOptions';
import {
  buildExamSchedule,
  type ExamSchedule,
} from '@/lib/planner/examSchedule';
import { DEFAULT_TEMPLATE } from '@/lib/planner/exportTemplates';
import { PreviewToolbar } from './PreviewToolbar';
import type { PlacedSection } from './placedSection';
import {
  makePlanEntry,
  makeSection,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import {
  resetPlanStore,
  seedActivePlan,
} from '../../../tests/support/plan-store';

const section: PlacedSection = {
  teachTableId: 't1',
  subjectId: '90592008',
  section: '901',
  nameTh: 'สังคมไทยในวันนี้',
  nameEn: "TODAY'S THAI SOCIETY",
  credit: 3,
  kind: 'lecture',
  rulesTh: '',
  rulesEn: '',
  remark: '',
  verifyStatus: 'verified',
  meetings: [
    {
      day: 1,
      startMin: 540,
      endMin: 660,
      room: 'A101',
      building: 'A',
      kind: 'lecture',
    },
  ],
};

const posterRef: RefObject<HTMLDivElement | null> = { current: null };

function renderToolbar(
  displayOptions: DisplayOptions = DEFAULT_DISPLAY_OPTIONS,
  examSchedule: ExamSchedule = buildExamSchedule([]),
) {
  render(
    <PreviewToolbar
      posterRef={posterRef}
      template={DEFAULT_TEMPLATE}
      sections={[section]}
      displayOptions={displayOptions}
      examSchedule={examSchedule}
    />,
  );
}

afterEach(() => {
  cleanup();
  resetPlanStore();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('PreviewToolbar', () => {
  it('replaces copy image with a note when the clipboard cannot take an image', () => {
    // jsdom exposes no ClipboardItem, so image copy is unsupported.
    vi.stubGlobal('ClipboardItem', undefined);
    renderToolbar();
    expect(
      screen.queryByRole('button', { name: 'คัดลอกรูปภาพ' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('เบราว์เซอร์นี้คัดลอกรูปภาพไม่ได้ ใช้ดาวน์โหลดแทน'),
    ).toBeInTheDocument();
    // The download action is still present, so the path is never a dead end.
    expect(
      screen.getByRole('button', { name: 'ดาวน์โหลดรูปภาพ' }),
    ).toBeInTheDocument();
  });

  it('shows the copy image control when the clipboard supports images', () => {
    vi.stubGlobal('ClipboardItem', {});
    vi.stubGlobal('navigator', { clipboard: { write: vi.fn() } });
    renderToolbar();
    expect(
      screen.getByRole('button', { name: 'คัดลอกรูปภาพ' }),
    ).toBeInTheDocument();
  });

  it('carries no template dropdown, since the picker is now the preview gallery', () => {
    renderToolbar();
    expect(
      screen.queryByRole('combobox', { name: 'แม่แบบ' }),
    ).not.toBeInTheDocument();
    // The display options and the sharing actions remain in the toolbar.
    expect(
      screen.getByRole('button', { name: 'ตัวเลือกการแสดงผล' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'ดาวน์โหลดรูปภาพ' }),
    ).toBeInTheDocument();
  });

  it('copies the plain text schedule to the clipboard', () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(() =>
      Promise.resolve(),
    );
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    renderToolbar();

    fireEvent.click(screen.getByRole('button', { name: 'คัดลอกข้อความ' }));
    expect(writeText).toHaveBeenCalledTimes(1);
    const text = writeText.mock.calls[0]?.[0];
    // The subject id is off by default, so the line leads with the course name.
    expect(text).toContain('สังคมไทยในวันนี้');
    expect(text).toContain('ตัววางแผนตารางเรียน สจล.');
  });

  it('appends the exam schedule to the copied text when the option is on', () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(() =>
      Promise.resolve(),
    );
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const schedule = buildExamSchedule([
      makePlanEntry({
        snapshot: makeSnapshot({
          ...makeSection({
            teachTableId: 't1',
            subjectId: '90592008',
            exam: {
              midterm: {
                start: '2026-12-10 09:00:00',
                end: '2026-12-10 12:00:00',
              },
            },
          }),
          subjectMeta: {
            subjectId: '90592008',
            nameTh: 'สังคมไทยในวันนี้',
            nameEn: "TODAY'S THAI SOCIETY",
            credit: 3,
            creditStr: '3(3-0-6)',
          },
        }),
      }),
    ]);
    renderToolbar(
      { ...DEFAULT_DISPLAY_OPTIONS, showEnglishNames: false, showExams: true },
      schedule,
    );

    fireEvent.click(screen.getByRole('button', { name: 'คัดลอกข้อความ' }));
    expect(writeText.mock.calls[0]?.[0]).toContain(
      'ตารางสอบ\nกลางภาค 10 ธ.ค. 2569 09:00-12:00 สังคมไทยในวันนี้ (901)',
    );
  });

  it('follows the toolbar with the pre share notice, never inside it', () => {
    act(() => {
      seedActivePlan([makePlanEntry({ verifyStatus: 'missing' })]);
    });
    renderToolbar();
    const text = 'มี 1 รายการที่ข้อมูลเปลี่ยนหรือไม่พบในระบบ ตรวจก่อนแชร์';
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(
      within(screen.getByRole('toolbar')).queryByText(text),
    ).not.toBeInTheDocument();
    // The sharing actions stay available beside the notice, so it never blocks an export.
    expect(
      screen.getByRole('button', { name: 'ดาวน์โหลดรูปภาพ' }),
    ).toBeInTheDocument();
  });

  it('shows no pre share notice for a clean plan', () => {
    act(() => {
      seedActivePlan([makePlanEntry({ verifyStatus: 'verified' })]);
    });
    renderToolbar();
    expect(
      screen.queryByRole('button', { name: 'ดูรายการ' }),
    ).not.toBeInTheDocument();
  });
});
