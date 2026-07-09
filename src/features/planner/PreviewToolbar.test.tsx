import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { RefObject } from 'react';
import { DEFAULT_DISPLAY_OPTIONS } from '@/lib/planner/displayOptions';
import { PreviewToolbar } from './PreviewToolbar';
import type { PlacedSection } from './placedSection';

const section: PlacedSection = {
  teachTableId: 't1',
  subjectId: '90592008',
  section: '901',
  nameTh: 'สังคมไทยในวันนี้',
  nameEn: "TODAY'S THAI SOCIETY",
  credit: 3,
  kind: 'lecture',
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

function renderToolbar() {
  render(
    <PreviewToolbar
      posterRef={posterRef}
      sections={[section]}
      displayOptions={DEFAULT_DISPLAY_OPTIONS}
    />,
  );
}

afterEach(() => {
  cleanup();
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

  it('copies the plain text schedule to the clipboard', () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(() =>
      Promise.resolve(),
    );
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    renderToolbar();

    fireEvent.click(screen.getByRole('button', { name: 'คัดลอกข้อความ' }));
    expect(writeText).toHaveBeenCalledTimes(1);
    const text = writeText.mock.calls[0]?.[0];
    expect(text).toContain('90592008 สังคมไทยในวันนี้');
    expect(text).toContain('ตัววางแผนตารางเรียน สจล.');
  });
});
