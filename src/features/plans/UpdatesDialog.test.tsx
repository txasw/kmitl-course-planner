import { describe, it, expect, afterEach, vi } from 'vitest';
import { useRef, useState } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { PlanEntry, ReviewKind } from '@/lib/domain/plan';
import type { TypedSend } from '@/lib/messaging/sendTyped';
import { SearchDepsProvider } from '@/features/search/SearchDepsContext';
import { PanelPortalContext } from '@/features/shell/PanelPortalContext';
import { toastStore } from '@/features/shell/toastStore';
import { useFocusTrap } from '@/features/shell/useFocusTrap';
import {
  makeMeeting,
  makePlanEntry,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import {
  resetPlanStore,
  seedActivePlan,
} from '../../../tests/support/plan-store';
import { fakeSearchDeps } from '../../../tests/support/searchDeps';
import { installViewport } from '../../../tests/support/viewport';
import { planStore } from './planStore';
import { revalidationStore } from './revalidationStore';
import { UpdatesDialog } from './UpdatesDialog';

afterEach(() => {
  cleanup();
  resetPlanStore();
  revalidationStore.setState({ runs: {} });
  toastStore.setState({ toast: null });
  vi.unstubAllGlobals();
});

function reviewed(
  id: string,
  kinds: ReviewKind[],
  overrides: Partial<PlanEntry> = {},
): PlanEntry {
  const before = makeSnapshot({
    teachTableId: id,
    subjectId: `9000000${id}`,
    section: `90${id}`,
    meetings: [makeMeeting({ room: 'A101' })],
  });
  return makePlanEntry({
    snapshot: {
      ...before,
      meetings: [makeMeeting({ room: 'B202' })],
    },
    verifyStatus: 'changed',
    review: {
      kinds,
      before,
      detectedAt: '2026-11-06T00:00:00.000Z',
      notifiedAt: null,
    },
    ...overrides,
  });
}

const PLAIN = makePlanEntry({
  snapshot: makeSnapshot({
    teachTableId: '9',
    subjectId: '90000009',
    meetings: [makeMeeting({ day: 5 })],
  }),
  verifyStatus: 'verified',
});

// The overlay shape: a trapped panel that is the portal root, with the dialog opened from
// a button inside a live region, the way the revalidation banner opens it.
function Panel({ onOverlayEscape }: { onOverlayEscape: () => void }) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  useFocusTrap(panelRef, true, onOverlayEscape);
  return (
    <div
      ref={(element) => {
        panelRef.current = element;
        setNode(element);
      }}
      tabIndex={-1}
    >
      <PanelPortalContext.Provider value={node}>
        <div aria-live="polite">
          <button
            type="button"
            onClick={() => {
              setOpen(true);
            }}
          >
            details
          </button>
        </div>
        {/* A placed block of entry 1, as the timetable renders it. */}
        <div
          role="button"
          data-teach-table-id="1"
          data-block-order="600"
          tabIndex={0}
        >
          block
        </div>
        {open ? (
          <UpdatesDialog
            onClose={() => {
              setOpen(false);
            }}
          />
        ) : null}
      </PanelPortalContext.Provider>
    </div>
  );
}

function openDialog(
  entries: PlanEntry[],
  { width = 1024, deps = fakeSearchDeps() } = {},
) {
  installViewport(width);
  act(() => {
    seedActivePlan(entries, { id: 'p1' });
  });
  const onOverlayEscape = vi.fn();
  render(
    <SearchDepsProvider value={deps}>
      <Panel onOverlayEscape={onOverlayEscape} />
    </SearchDepsProvider>,
  );
  const opener = screen.getByRole('button', { name: 'details' });
  opener.focus();
  fireEvent.click(opener);
  return { opener, onOverlayEscape };
}

describe('UpdatesDialog', () => {
  it('is a modal dialog named and described, outside the live region', () => {
    openDialog([reviewed('1', ['room_changed'])]);
    const dialog = screen.getByRole('dialog', {
      name: 'ข้อมูลในตารางมีการเปลี่ยนแปลง',
    });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription(/ข้อมูลล่าสุดจากสำนักทะเบียน/);
    expect(dialog.closest('[aria-live]')).toBeNull();
    expect(dialog).toHaveClass('max-w-[32rem]');
  });

  it('starts focus on the acknowledgement', () => {
    openDialog([reviewed('1', ['room_changed'])]);
    expect(
      screen.getByRole('button', { name: 'รับทราบทั้งหมด' }),
    ).toHaveFocus();
  });

  it('lists the groups in order with before and now lines, never as articles', () => {
    openDialog([
      reviewed('1', ['room_changed']),
      reviewed('2', ['missing'], { verifyStatus: 'missing' }),
      PLAIN,
    ]);
    const dialog = screen.getByRole('dialog');
    const headings = within(dialog)
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual([
      'เวลาชนกันหรือไม่พบในระบบ',
      'เวลาเรียนและห้องเรียน',
    ]);
    expect(within(dialog).getByText('ไม่พบในระบบแล้ว')).toBeInTheDocument();
    expect(within(dialog).getByText('ห้องเรียนเปลี่ยน')).toBeInTheDocument();
    expect(within(dialog).getByText('เดิม')).toBeInTheDocument();
    expect(within(dialog).getByText('A A101')).toBeInTheDocument();
    expect(within(dialog).getByText('ใหม่')).toBeInTheDocument();
    expect(within(dialog).getByText('A B202')).toBeInTheDocument();
    expect(
      within(dialog).getByText('ไม่เปลี่ยนแปลง 1 รายการ'),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole('article')).toBeNull();
  });

  it('treats Escape as later: it marks the items shown and the overlay stays open', () => {
    const { opener, onOverlayEscape } = openDialog([
      reviewed('1', ['room_changed']),
    ]);
    fireEvent.keyDown(screen.getByRole('button', { name: 'รับทราบทั้งหมด' }), {
      key: 'Escape',
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onOverlayEscape).not.toHaveBeenCalled();
    const entry = planStore.getState().entries[0];
    expect(entry?.review?.notifiedAt).not.toBeNull();
    expect(entry?.verifyStatus).toBe('changed');
    expect(opener).toHaveFocus();
  });

  it('acknowledges every item, toasts once, and returns focus to the opener', () => {
    const show = vi.spyOn(toastStore.getState(), 'show');
    const { opener } = openDialog([
      reviewed('1', ['room_changed']),
      reviewed('2', ['exam_changed']),
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'รับทราบทั้งหมด' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    for (const entry of planStore.getState().entries) {
      expect(entry).not.toHaveProperty('review');
      expect(entry.verifyStatus).toBe('verified');
    }
    expect(show).toHaveBeenCalledTimes(1);
    expect(show).toHaveBeenCalledWith('success', 'รับทราบการเปลี่ยนแปลงแล้ว');
    expect(opener).toHaveFocus();
  });

  it('runs a manual check from the link and shows it running', () => {
    // The check only sends teachTable/query and this test never settles it, so a
    // pending fake is enough; the cast is confined to this test seam.
    const send = vi.fn(() => new Promise(() => undefined));
    const sourceQuery = {
      endpoint: 'get-teach-table-show' as const,
      params: {
        mode: 'by_subject_id',
        selected_year: '2569',
        selected_semester: '1',
        search_all_faculty: 'true',
        search_all_department: 'true',
        search_all_curriculum: 'true',
        search_all_class_year: 'true',
        selected_subject_id: '90000001',
      },
    };
    openDialog([reviewed('1', ['room_changed'], { sourceQuery })], {
      deps: fakeSearchDeps({ send: send as unknown as TypedSend }),
    });
    fireEvent.click(screen.getByRole('button', { name: 'ตรวจสอบอีกครั้ง' }));
    expect(send).toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'กำลังตรวจสอบข้อมูล' }),
    ).toBeDisabled();
  });

  it('closes on its own once a check leaves nothing to review', () => {
    openDialog([reviewed('1', ['room_changed'])]);
    act(() => {
      planStore.getState().acknowledge('1');
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('is a full height bottom sheet below 640 px', () => {
    openDialog([reviewed('1', ['room_changed'])], { width: 375 });
    const dialog = screen.getByRole('dialog', {
      name: 'ข้อมูลในตารางมีการเปลี่ยนแปลง',
    });
    expect(dialog).toHaveClass('h-dvh');
    expect(
      screen.getByRole('button', { name: 'รับทราบทั้งหมด' }),
    ).toHaveFocus();
  });

  it('shows an item on the timetable: it closes, focuses and pulses the block', async () => {
    // jsdom has no layout and does not implement scrollIntoView.
    Element.prototype.scrollIntoView = vi.fn();
    openDialog([reviewed('1', ['room_changed'])]);
    fireEvent.click(
      screen.getByRole('button', { name: 'ดูในตาราง 90000001 กลุ่มเรียน 901' }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    const block = screen.getByText('block');
    await waitFor(() => {
      expect(block).toHaveFocus();
    });
    expect(block).toHaveClass('kcp-locate');
    expect(planStore.getState().entries[0]?.review?.notifiedAt).not.toBeNull();
  });

  it('removes a missing section with undo, keeping it listed as removed', () => {
    openDialog([
      reviewed('1', ['missing'], { verifyStatus: 'missing' }),
      reviewed('2', ['room_changed']),
    ]);
    const remove = screen.getByRole('button', {
      name: 'นำออกจากตาราง 90000001 กลุ่มเรียน 901',
    });
    expect(
      screen.queryByRole('button', { name: /^นำออกจากตาราง 90000002/ }),
    ).toBeNull();
    fireEvent.click(remove);
    expect(
      planStore.getState().entries.map((entry) => entry.teachTableId),
    ).toEqual(['2']);
    expect(screen.getByText('นำออกแล้ว')).toBeInTheDocument();
    const undo = screen.getByRole('button', {
      name: 'เลิกทำ 90000001 กลุ่มเรียน 901',
    });
    expect(undo).toHaveFocus();

    fireEvent.click(undo);
    expect(planStore.getState().entries).toHaveLength(2);
    expect(screen.queryByText('นำออกแล้ว')).toBeNull();
    expect(
      screen.getByRole('button', {
        name: 'นำออกจากตาราง 90000001 กลุ่มเรียน 901',
      }),
    ).toHaveFocus();
  });

  it('stays open with the removed item when it was the last to review', () => {
    openDialog([reviewed('1', ['missing'], { verifyStatus: 'missing' })]);
    fireEvent.click(
      screen.getByRole('button', {
        name: 'นำออกจากตาราง 90000001 กลุ่มเรียน 901',
      }),
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('นำออกแล้ว')).toBeInTheDocument();
  });
});
