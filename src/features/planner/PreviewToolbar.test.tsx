import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
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
import { capturePng } from './capture';
import { downloadBlob } from '@/lib/utils/download';
import { toastStore } from '@/features/shell/toastStore';
import type { PlacedSection } from './placedSection';
import { revalidationStore } from '@/features/plans/revalidationStore';
import { SearchDepsProvider } from '@/features/search/SearchDepsContext';
import { fakeSearchDeps } from '../../../tests/support/searchDeps';
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

// The capture and the file save are stubbed: jsdom cannot rasterize a node or save a
// file, and the busy state is about the time between the press and the outcome.
vi.mock('./capture', () => ({ capturePng: vi.fn() }));
vi.mock('@/lib/utils/download', () => ({ downloadBlob: vi.fn() }));

const posterRef: RefObject<HTMLDivElement | null> = { current: null };

// The verification status in the toolbar reads the search deps for its retry send.
function renderToolbar(
  displayOptions: DisplayOptions = DEFAULT_DISPLAY_OPTIONS,
  examSchedule: ExamSchedule = buildExamSchedule([]),
  ref: RefObject<HTMLDivElement | null> = posterRef,
) {
  render(
    <SearchDepsProvider value={fakeSearchDeps()}>
      <PreviewToolbar
        posterRef={ref}
        template={DEFAULT_TEMPLATE}
        sections={[section]}
        displayOptions={displayOptions}
        examSchedule={examSchedule}
      />
    </SearchDepsProvider>,
  );
}

afterEach(() => {
  cleanup();
  resetPlanStore();
  revalidationStore.setState({ runs: {}, updatesOpen: false });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
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
    expect(text).toContain('KCP: ตัววางแผนตารางเรียน สจล.');
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

  it('keeps an offline check and its retry in the toolbar, so preview never hides them', () => {
    act(() => {
      seedActivePlan([makePlanEntry({ verifyStatus: 'unverified' })], {
        id: 'p1',
      });
      revalidationStore
        .getState()
        .setRun('p1', { status: 'offline', report: null });
    });
    renderToolbar();
    const toolbar = screen.getByRole('toolbar');
    expect(
      within(toolbar).getByText('ยังตรวจสอบไม่ได้ แสดงข้อมูลที่บันทึกไว้'),
    ).toBeInTheDocument();
    expect(
      within(toolbar).getByRole('button', { name: 'ลองอีกครั้ง' }),
    ).toBeInTheDocument();
  });

  it('offers check again in the toolbar after a clean check', () => {
    act(() => {
      seedActivePlan(
        [makePlanEntry({ lastVerifiedAt: new Date().toISOString() })],
        { id: 'p1' },
      );
    });
    renderToolbar();
    const toolbar = screen.getByRole('toolbar');
    expect(within(toolbar).getByText(/ตรวจสอบแล้ว/)).toBeInTheDocument();
    expect(
      within(toolbar).getByRole('button', { name: 'ตรวจสอบอีกครั้ง' }),
    ).toBeInTheDocument();
  });

  it('holds every sharing action busy while an image capture runs', async () => {
    vi.stubGlobal('ClipboardItem', {});
    vi.stubGlobal('navigator', { clipboard: { write: vi.fn() } });
    let finish: (blob: Blob) => void = () => undefined;
    vi.mocked(capturePng).mockReturnValue(
      new Promise<Blob>((resolve) => {
        finish = resolve;
      }),
    );
    renderToolbar(DEFAULT_DISPLAY_OPTIONS, buildExamSchedule([]), {
      current: document.createElement('div'),
    });

    fireEvent.click(screen.getByRole('button', { name: 'ดาวน์โหลดรูปภาพ' }));
    // The pressed action names the capture, and every action is marked disabled.
    const busy = screen.getByRole('button', { name: 'กำลังสร้างรูปภาพ' });
    expect(busy).toHaveAttribute('aria-disabled', 'true');
    const copyImage = screen.getByRole('button', { name: 'คัดลอกรูปภาพ' });
    const copyText = screen.getByRole('button', { name: 'คัดลอกข้อความ' });
    expect(copyImage).toHaveAttribute('aria-disabled', 'true');
    expect(copyText).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('toolbar')).toHaveAttribute('aria-busy', 'true');

    // A second press while busy starts no parallel capture.
    fireEvent.click(copyImage);
    fireEvent.click(busy);
    expect(capturePng).toHaveBeenCalledTimes(1);

    await act(async () => {
      finish(new Blob(['png'], { type: 'image/png' }));
      await Promise.resolve();
    });
    expect(downloadBlob).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('button', { name: 'ดาวน์โหลดรูปภาพ' }),
    ).toHaveAttribute('aria-disabled', 'false');
    expect(screen.getByRole('toolbar')).toHaveAttribute('aria-busy', 'false');
    expect(toastStore.getState().toast?.message).toBe('ดาวน์โหลดรูปภาพแล้ว');
  });

  it('clears the busy state and reports a failed capture', async () => {
    vi.stubGlobal('ClipboardItem', undefined);
    vi.mocked(capturePng).mockRejectedValue(new Error('no image'));
    renderToolbar(DEFAULT_DISPLAY_OPTIONS, buildExamSchedule([]), {
      current: document.createElement('div'),
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'ดาวน์โหลดรูปภาพ' }));
      await Promise.resolve();
    });
    expect(
      screen.getByRole('button', { name: 'ดาวน์โหลดรูปภาพ' }),
    ).toHaveAttribute('aria-disabled', 'false');
    expect(toastStore.getState().toast?.message).toBe('ส่งออกรูปภาพไม่สำเร็จ');
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

describe('PreviewToolbar share image', () => {
  const SHARE = 'แชร์รูปภาพ';
  type Share = (data: ShareData) => Promise<void>;

  // The earlier cases leave their toast behind, and these assert there is none.
  beforeEach(() => {
    toastStore.getState().dismiss();
  });

  // Let the capture, the share, and their toasts settle.
  const settle = () =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

  function stubShare(share: Share) {
    const spy = vi.fn(share);
    vi.stubGlobal('ClipboardItem', undefined);
    vi.stubGlobal('navigator', { share: spy, canShare: () => true });
    vi.mocked(capturePng).mockResolvedValue(
      new Blob(['png'], { type: 'image/png' }),
    );
    return spy;
  }

  function renderWithPoster(
    node: HTMLDivElement = document.createElement('div'),
  ) {
    renderToolbar(DEFAULT_DISPLAY_OPTIONS, buildExamSchedule([]), {
      current: node,
    });
  }

  it('offers no share action where the browser cannot share a file', () => {
    renderToolbar();
    expect(
      screen.queryByRole('button', { name: SHARE }),
    ).not.toBeInTheDocument();
  });

  it('offers no share action where the browser cannot share a PNG', () => {
    vi.stubGlobal('navigator', { share: vi.fn(), canShare: () => false });
    renderToolbar();
    expect(
      screen.queryByRole('button', { name: SHARE }),
    ).not.toBeInTheDocument();
  });

  it('shares the captured poster as a PNG file through the share sheet', async () => {
    const share = stubShare(() => Promise.resolve());
    renderWithPoster();

    fireEvent.click(screen.getByRole('button', { name: SHARE }));
    await settle();
    expect(share).toHaveBeenCalledTimes(1);
    const file = share.mock.calls[0]?.[0].files?.[0];
    expect(file?.type).toBe('image/png');
    expect(file?.name).toBe(`kmitl-plan-${DEFAULT_TEMPLATE.slug}.png`);
    // The share sheet is the visible outcome, so no toast follows a share.
    expect(toastStore.getState().toast).toBeNull();
  });

  it('stays silent when the student closes the share sheet', async () => {
    stubShare(() => Promise.reject(new DOMException('closed', 'AbortError')));
    renderWithPoster();

    fireEvent.click(screen.getByRole('button', { name: SHARE }));
    await settle();
    expect(toastStore.getState().toast).toBeNull();
  });

  it('reports a share the browser refused for another reason', async () => {
    stubShare(() => Promise.reject(new DOMException('bad', 'DataError')));
    renderWithPoster();

    fireEvent.click(screen.getByRole('button', { name: SHARE }));
    await settle();
    expect(toastStore.getState().toast?.message).toBe('แชร์รูปภาพไม่สำเร็จ');
  });

  it('holds the image for a fresh press when the capture outlasted the press', async () => {
    let calls = 0;
    const share = stubShare(() => {
      calls += 1;
      return calls === 1
        ? Promise.reject(new DOMException('no gesture', 'NotAllowedError'))
        : Promise.resolve();
    });
    renderWithPoster();
    const button = screen.getByRole('button', { name: SHARE });

    fireEvent.click(button);
    await settle();
    const toast = toastStore.getState().toast;
    expect(toast?.message).toBe('รูปภาพพร้อมแชร์แล้ว');
    expect(toast?.action?.label).toBe(SHARE);

    // The toast action opens the sheet with the held file, without a second capture.
    act(() => {
      toast?.action?.run(button);
    });
    await settle();
    expect(capturePng).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledTimes(2);
    expect(share.mock.calls[1]?.[0].files?.[0]).toBe(
      share.mock.calls[0]?.[0].files?.[0],
    );
  });

  it('takes down the share offer when the toolbar leaves preview', async () => {
    stubShare(() =>
      Promise.reject(new DOMException('no gesture', 'NotAllowedError')),
    );
    renderWithPoster();

    fireEvent.click(screen.getByRole('button', { name: SHARE }));
    await settle();
    expect(toastStore.getState().toast?.message).toBe('รูปภาพพร้อมแชร์แล้ว');
    cleanup();
    expect(toastStore.getState().toast).toBeNull();
  });

  // The change reaches the observer either before the press, or still queued at the press.
  it.each([
    ['delivered', true],
    ['still queued', false],
  ])(
    'captures again when the poster changed after the image was held, %s',
    async (_label, deliverFirst) => {
      const share = stubShare(() =>
        Promise.reject(new DOMException('no gesture', 'NotAllowedError')),
      );
      const node = document.createElement('div');
      renderWithPoster(node);
      const button = screen.getByRole('button', { name: SHARE });

      fireEvent.click(button);
      await settle();
      node.append(document.createElement('span'));
      if (deliverFirst) {
        await settle();
      }
      fireEvent.click(button);
      await settle();
      expect(capturePng).toHaveBeenCalledTimes(2);
      expect(share).toHaveBeenCalledTimes(2);
    },
  );
});
