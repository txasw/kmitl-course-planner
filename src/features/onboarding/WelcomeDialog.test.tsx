import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { useStore } from 'zustand';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { LAUNCHER_ID } from '@/features/shell/Launcher';
import { PanelPortalContext } from '@/features/shell/PanelPortalContext';
import { uiStore } from '@/features/shell/uiStore';
import { installViewport } from '../../../tests/support/viewport';
import { initialOnboardingData, onboardingStore } from './onboardingStore';
import { WelcomeDialog } from './WelcomeDialog';

const TITLE = 'ขอบคุณที่ติดตั้ง KCP: Course Planner for KMITL';
const START = 'เริ่มวางแผน';
const CLOSE = 'ปิดข้อความต้อนรับ';

// The layer shape: a launcher outside the layer, and a portal node that renders the
// dialog while the store holds the welcome open.
function Harness() {
  const open = useStore(onboardingStore, (state) => state.welcomeOpen);
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  return (
    <>
      <button id={LAUNCHER_ID} type="button">
        launcher
      </button>
      <div ref={setNode}>
        <PanelPortalContext.Provider value={node}>
          {open ? <WelcomeDialog /> : null}
        </PanelPortalContext.Provider>
      </div>
    </>
  );
}

function showWelcome(
  width = 1366,
  { shortcut = null }: { shortcut?: string | null } = {},
) {
  installViewport(width);
  act(() => {
    onboardingStore.getState().setShortcut(shortcut);
    onboardingStore.getState().setWelcomeOpen(true);
  });
  render(<Harness />);
  return screen.getByRole('dialog');
}

function expectClosedToLauncher(): void {
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(onboardingStore.getState().welcomeOpen).toBe(false);
  expect(screen.getByRole('button', { name: 'launcher' })).toHaveFocus();
}

afterEach(() => {
  cleanup();
  act(() => {
    uiStore.getState().close();
    uiStore.getState().setViewMode('edit');
    uiStore.getState().setLanguage('th');
  });
  onboardingStore.setState(initialOnboardingData());
  vi.unstubAllGlobals();
});

describe('WelcomeDialog', () => {
  it.each([768, 1366])(
    'is a narrow centred dialog at %i px, named and described',
    (width) => {
      const dialog = showWelcome(width);
      expect(dialog).toHaveAccessibleName(TITLE);
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveClass('max-w-md');
      expect(dialog).toHaveAccessibleDescription(
        /วางแผนตารางเรียนก่อนลงทะเบียน/,
      );
    },
  );

  it('is a bottom sheet at 390 px', () => {
    const dialog = showWelcome(390);
    expect(dialog).not.toHaveClass('max-w-md');
    expect(dialog).toHaveClass('rounded-t-kcp-sheet');
  });

  it('lists the three steps in order', () => {
    const dialog = showWelcome();
    const list = within(dialog).getByRole('list');
    expect(list.tagName).toBe('OL');
    const items = within(list).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'ค้นหารายวิชาค้นหาตามหลักสูตรและชั้นปี รหัสวิชา หรือหมวดวิชา',
      'ลากกลุ่มเรียนลงตารางระบบจะแจ้งทันทีเมื่อเวลาเรียนหรือเวลาสอบชนกัน',
      'แชร์เป็นรูปภาพดาวน์โหลดหรือคัดลอกตารางเป็นรูปภาพเพื่อส่งต่อ',
    ]);
    expect(
      within(dialog).getByRole('heading', { name: 'เริ่มใช้งานใน 3 ขั้น' }),
    ).toBeInTheDocument();
  });

  it('starts focus on Start planning and wraps Tab inside', () => {
    showWelcome();
    const start = screen.getByRole('button', { name: START });
    expect(start).toHaveFocus();
    fireEvent.keyDown(start, { key: 'Tab' });
    const close = screen.getByRole('button', { name: CLOSE });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(start).toHaveFocus();
  });

  it('closes on Escape and hands focus to the launcher', () => {
    showWelcome();
    fireEvent.keyDown(screen.getByRole('button', { name: START }), {
      key: 'Escape',
    });
    expectClosedToLauncher();
    expect(uiStore.getState().isOpen).toBe(false);
  });

  it('closes from the close button', () => {
    showWelcome();
    fireEvent.click(screen.getByRole('button', { name: CLOSE }));
    expectClosedToLauncher();
    expect(uiStore.getState().isOpen).toBe(false);
  });

  it('closes from the scrim', () => {
    const dialog = showWelcome();
    const scrim = dialog.parentElement?.querySelector(
      'button[aria-hidden="true"]',
    );
    if (scrim === null || scrim === undefined) throw new Error('no scrim');
    fireEvent.click(scrim);
    expectClosedToLauncher();
  });

  it('closes and opens the panel at the catalog from Start planning', () => {
    act(() => {
      uiStore.getState().setViewMode('preview');
    });
    showWelcome();
    fireEvent.click(screen.getByRole('button', { name: START }));
    expectClosedToLauncher();
    expect(uiStore.getState().isOpen).toBe(true);
    expect(uiStore.getState().viewMode).toBe('edit');
  });

  it('names the shortcut only when the browser reports one', () => {
    const dialog = showWelcome(1366, { shortcut: 'Alt+Shift+P' });
    expect(
      within(dialog).getByText(
        'เปิดได้ทุกเมื่อจากปุ่ม Planner มุมขวาล่าง ไอคอนส่วนขยาย หรือแป้นลัด Alt+Shift+P',
      ),
    ).toBeInTheDocument();
    cleanup();
    const plain = showWelcome(1366, { shortcut: null });
    expect(
      within(plain).getByText(
        'เปิดได้ทุกเมื่อจากปุ่ม Planner มุมขวาล่าง หรือไอคอนส่วนขยาย',
      ),
    ).toBeInTheDocument();
    expect(within(plain).queryByText(/แป้นลัด/)).toBeNull();
  });

  it('follows the panel language', () => {
    act(() => {
      uiStore.getState().setLanguage('en');
    });
    expect(showWelcome()).toHaveAccessibleName(
      'Thank you for installing KCP: Course Planner for KMITL',
    );
    expect(
      screen.getByRole('button', { name: 'Start planning' }),
    ).toHaveFocus();
  });
});
