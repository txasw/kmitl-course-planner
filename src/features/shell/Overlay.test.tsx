import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  onTestFinished,
  vi,
} from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
  within,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { CATALOG_COLUMN_ID } from './catalogVisibility';
import { Overlay } from './Overlay';
import { Toaster } from './Toaster';
import { toastStore } from './toastStore';
import { openPanelAt } from './openPanel';
import { uiStore } from './uiStore';
import { OVERLAY_HISTORY_MARKER } from './useBackToClose';
import { autosaveStore } from '@/features/plans/autosaveStore';
import { revalidationStore } from '@/features/plans/revalidationStore';
import { SearchDepsProvider } from '@/features/search/SearchDepsContext';
import { makePlanEntry } from '../../../tests/support/domain-builders';
import {
  resetPlanStore,
  seedActivePlan,
} from '../../../tests/support/plan-store';
import { fakeSearchDeps } from '../../../tests/support/searchDeps';
import { installViewport } from '../../../tests/support/viewport';
import { installVisualViewport } from '../../../tests/support/visualViewport';
import { VIEWPORT_BOTTOM_PROPERTY, VIEWPORT_FIT } from '@/lib/ui/viewportInset';

// The plan switcher trigger names the active plan and its term before its action, so
// a query matches the action at the end of the name.
const PLAN_TRIGGER = /เลือกตาราง$/;

const deps = fakeSearchDeps();

function wrapper({ children }: { children: ReactNode }) {
  return <SearchDepsProvider value={deps}>{children}</SearchDepsProvider>;
}

// Reduced motion makes the presence transitions instant, so open and close are
// deterministic in tests without advancing timers.
function stubReducedMotion() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }));
}

beforeEach(stubReducedMotion);

/** Resolve on the next popstate, the end of a queued traversal. */
function nextPopState(): Promise<void> {
  return new Promise((resolve) => {
    window.addEventListener(
      'popstate',
      () => {
        resolve();
      },
      { once: true },
    );
  });
}

function holdsPanelEntry(): boolean {
  const state: unknown = window.history.state;
  return (
    typeof state === 'object' &&
    state !== null &&
    OVERLAY_HISTORY_MARKER in state
  );
}

afterEach(async () => {
  // Leave the export page while mounted, so its history layer unwinds before the
  // unmount, which cleans up the overlay first and would otherwise strand its entry.
  act(() => {
    uiStore.getState().setViewMode('edit');
  });
  cleanup();
  vi.unstubAllGlobals();
  act(() => {
    uiStore.getState().close();
    uiStore.getState().setLanguage('th');
    uiStore.getState().setViewMode('edit');
  });
  // While the panel and the shortcut help hold history entries, closing them goes back
  // through queued traversals; wait for each, so the next test opens from a settled history.
  while (holdsPanelEntry()) await nextPopState();
});

describe('Overlay', () => {
  it('renders nothing while closed', () => {
    render(<Overlay />, { wrapper });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders a labelled modal dialog when opened', () => {
    act(() => {
      uiStore.getState().open();
    });
    render(<Overlay />, { wrapper });
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('KCP: ตัววางแผนตารางเรียน สจล.');
  });

  it('shows a failed save in a strip right under the header', () => {
    act(() => {
      uiStore.getState().open();
      autosaveStore.getState().attach(vi.fn());
    });
    onTestFinished(() => {
      act(() => {
        autosaveStore.getState().detach();
      });
    });
    render(<Overlay />, { wrapper });
    const header = screen.getByRole('dialog').querySelector('header');
    expect(header?.nextElementSibling).not.toHaveTextContent('บันทึกอีกครั้ง');
    act(() => {
      autosaveStore.getState().setStatus('failed');
    });
    const retry = screen.getByRole('button', { name: 'บันทึกอีกครั้ง' });
    expect(header?.nextElementSibling).toContainElement(retry);
    expect(header).not.toContainElement(retry);
  });

  it('marks the panel with the active language, not the host one', () => {
    act(() => {
      uiStore.getState().open();
    });
    render(<Overlay />, { wrapper });
    expect(screen.getByRole('dialog')).toHaveAttribute('lang', 'th');
    act(() => {
      uiStore.getState().setLanguage('en');
    });
    expect(screen.getByRole('dialog')).toHaveAttribute('lang', 'en');
  });

  it('closes on Escape', () => {
    act(() => {
      uiStore.getState().open();
    });
    render(<Overlay />, { wrapper });
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(uiStore.getState().isOpen).toBe(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the shortcut help on the question mark and closes it alone on Escape', () => {
    act(() => {
      uiStore.getState().open();
    });
    render(<Overlay />, { wrapper });
    const panel = screen.getByRole('dialog');
    fireEvent.keyDown(panel, { key: '?', code: 'Slash', shiftKey: true });
    const help = screen.getByRole('dialog', { name: 'แป้นพิมพ์ลัด' });
    expect(panel).toContainElement(help);
    fireEvent.keyDown(help, { key: 'Escape' });
    expect(
      screen.queryByRole('dialog', { name: 'แป้นพิมพ์ลัด' }),
    ).not.toBeInTheDocument();
    expect(uiStore.getState().isOpen).toBe(true);
  });

  it('closes when the close control is activated', () => {
    act(() => {
      uiStore.getState().open();
    });
    render(<Overlay />, { wrapper });
    fireEvent.click(screen.getByRole('button', { name: 'ปิด' }));
    expect(uiStore.getState().isOpen).toBe(false);
  });

  it('moves focus into the dialog and restores it on close', () => {
    render(
      <div>
        <button data-testid="opener">opener</button>
        <Overlay />
      </div>,
      { wrapper },
    );
    const opener = screen.getByTestId('opener');
    opener.focus();

    act(() => {
      uiStore.getState().open();
    });
    expect(screen.getByRole('dialog')).toHaveFocus();

    act(() => {
      uiStore.getState().close();
    });
    expect(opener).toHaveFocus();
  });

  it('reaches a toast action by Tab without the toast taking focus', () => {
    render(
      <div>
        <Overlay />
        <Toaster />
      </div>,
      { wrapper },
    );
    act(() => {
      uiStore.getState().open();
    });
    const dialog = screen.getByRole('dialog');
    const close = within(dialog).getByRole('button', { name: 'ปิด' });
    close.focus();
    act(() => {
      toastStore.getState().show('success', 'คัดลอกแล้ว', {
        label: 'ดูตาราง',
        run: () => undefined,
      });
    });
    expect(close).toHaveFocus();
    const stops = Array.from(
      dialog.querySelectorAll<HTMLElement>('button:not([disabled])'),
    ).filter((node) => node.closest('[inert]') === null);
    const last = stops[stops.length - 1];
    if (last === undefined) {
      throw new Error('expected a control in the panel');
    }
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'ดูตาราง' })).toHaveFocus();
    act(() => {
      toastStore.getState().dismiss();
    });
  });

  // The toast's own listener stops an Escape it handles before the press reaches the
  // panel trap's decider, so one press closes one layer: the toast, then the panel.
  it('dismisses only the toast on Escape from its action, then closes on the next', () => {
    render(
      <div>
        <Overlay />
        <Toaster />
      </div>,
      { wrapper },
    );
    act(() => {
      uiStore.getState().open();
    });
    act(() => {
      toastStore.getState().show('success', 'นำออกแล้ว', {
        label: 'เลิกทำ',
        run: () => undefined,
      });
    });
    const undo = screen.getByRole('button', { name: 'เลิกทำ' });
    undo.focus();
    fireEvent.keyDown(undo, { key: 'Escape' });
    expect(toastStore.getState().toast).toBeNull();
    expect(screen.queryByRole('button', { name: 'เลิกทำ' })).toBeNull();
    expect(uiStore.getState().isOpen).toBe(true);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // The trap's own drop recovery has its test in useFocusTrap; jsdom fires no focusout
    // on removal, so the next press starts on the panel here.
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(uiStore.getState().isOpen).toBe(false);
  });

  // Each path ends on the host entry it opened from, with the same route and the same
  // history state, router key included, as before the panel opened.
  describe('history', () => {
    const HOST_HASH = '#/teach_table_selector';
    const HOST_STATE = { key: '1234.567' };

    function openFrom(opener: boolean): void {
      window.history.replaceState(HOST_STATE, '', `/${HOST_HASH}`);
      render(
        <div>
          {opener ? <button data-testid="opener">opener</button> : null}
          <Overlay />
        </div>,
        { wrapper },
      );
      if (opener) screen.getByTestId('opener').focus();
      act(() => {
        uiStore.getState().open();
      });
    }

    function expectHostEntry(): void {
      expect(window.location.hash).toBe(HOST_HASH);
      expect(window.history.state).toEqual(HOST_STATE);
    }

    it('closes on a back gesture and restores focus', async () => {
      openFrom(true);
      const popped = nextPopState();
      window.history.back();
      await act(() => popped);
      expect(uiStore.getState().isOpen).toBe(false);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByTestId('opener')).toHaveFocus();
      expectHostEntry();
    });

    it('returns to the host entry when closed on Escape', async () => {
      openFrom(false);
      const popped = nextPopState();
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      await act(() => popped);
      expect(uiStore.getState().isOpen).toBe(false);
      expectHostEntry();
    });

    it('closes the shortcut help alone on a back gesture and the panel on a second', async () => {
      openFrom(false);
      fireEvent.keyDown(screen.getByRole('dialog'), {
        key: '?',
        code: 'Slash',
        shiftKey: true,
      });
      expect(
        screen.getByRole('dialog', { name: 'แป้นพิมพ์ลัด' }),
      ).toBeInTheDocument();
      const first = nextPopState();
      window.history.back();
      await act(() => first);
      expect(
        screen.queryByRole('dialog', { name: 'แป้นพิมพ์ลัด' }),
      ).not.toBeInTheDocument();
      expect(uiStore.getState().isOpen).toBe(true);
      const second = nextPopState();
      window.history.back();
      await act(() => second);
      expect(uiStore.getState().isOpen).toBe(false);
      expectHostEntry();
    });

    it('returns to the host entry when the close control is activated', async () => {
      openFrom(false);
      const popped = nextPopState();
      fireEvent.click(screen.getByRole('button', { name: 'ปิด' }));
      await act(() => popped);
      expect(uiStore.getState().isOpen).toBe(false);
      expectHostEntry();
    });

    it('leaves the export page alone on a back gesture and closes the panel on a second', async () => {
      openFrom(false);
      fireEvent.click(screen.getByRole('button', { name: 'ส่งออก' }));
      expect(uiStore.getState().viewMode).toBe('preview');
      const first = nextPopState();
      window.history.back();
      await act(() => first);
      expect(uiStore.getState().viewMode).toBe('edit');
      expect(uiStore.getState().isOpen).toBe(true);
      const second = nextPopState();
      window.history.back();
      await act(() => second);
      expect(uiStore.getState().isOpen).toBe(false);
      expectHostEntry();
    });

    it('unwinds the export page entry with the button and keeps the panel entry', async () => {
      openFrom(false);
      fireEvent.click(screen.getByRole('button', { name: 'ส่งออก' }));
      const popped = nextPopState();
      fireEvent.click(screen.getByRole('button', { name: 'กลับไปแก้ไข' }));
      await act(() => popped);
      expect(uiStore.getState().viewMode).toBe('edit');
      expect(holdsPanelEntry()).toBe(true);
      const closed = nextPopState();
      window.history.back();
      await act(() => closed);
      expect(uiStore.getState().isOpen).toBe(false);
      expectHostEntry();
    });

    it('returns to the host entry when closed from the export page', async () => {
      openFrom(false);
      fireEvent.click(screen.getByRole('button', { name: 'ส่งออก' }));
      fireEvent.click(screen.getByRole('button', { name: 'ปิด' }));
      while (holdsPanelEntry()) await act(() => nextPopState());
      expect(uiStore.getState().isOpen).toBe(false);
      expectHostEntry();
    });
  });

  describe('export page', () => {
    function openPanel(): void {
      act(() => {
        uiStore.getState().open();
      });
      render(<Overlay />, { wrapper });
    }

    // A browser focuses a button it presses, which fireEvent.click alone does not.
    function press(name: string): void {
      const button = screen.getByRole('button', { name });
      button.focus();
      fireEvent.click(button);
    }

    it('opens from the one export button and moves focus to the way back', () => {
      openPanel();
      const header = screen.getByRole('banner');
      expect(
        screen.queryByRole('button', { name: 'กลับไปแก้ไข' }),
      ).not.toBeInTheDocument();
      press('ส่งออก');
      expect(uiStore.getState().viewMode).toBe('preview');
      expect(
        screen.getByRole('toolbar', { name: 'เครื่องมือสำหรับแชร์' }),
      ).toBeInTheDocument();
      const back = screen.getByRole('button', { name: 'กลับไปแก้ไข' });
      expect(header).toContainElement(back);
      expect(back).toHaveFocus();
      expect(
        screen.queryByRole('button', { name: 'ส่งออก' }),
      ).not.toBeInTheDocument();
    });

    it('returns to editing from the back button with focus on the export button', () => {
      openPanel();
      press('ส่งออก');
      press('กลับไปแก้ไข');
      expect(uiStore.getState().viewMode).toBe('edit');
      expect(screen.getByRole('button', { name: 'ส่งออก' })).toHaveFocus();
    });

    it('returns to editing on Escape and keeps the panel open', () => {
      openPanel();
      press('ส่งออก');
      fireEvent.keyDown(screen.getByRole('button', { name: 'กลับไปแก้ไข' }), {
        key: 'Escape',
      });
      expect(uiStore.getState().viewMode).toBe('edit');
      expect(uiStore.getState().isOpen).toBe(true);
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      expect(uiStore.getState().isOpen).toBe(false);
    });

    it('opens in edit again after the panel closed on the export page', () => {
      openPanel();
      press('ส่งออก');
      fireEvent.click(screen.getByRole('button', { name: 'ปิด' }));
      act(() => {
        uiStore.getState().open();
      });
      expect(uiStore.getState().viewMode).toBe('edit');
      expect(screen.getByRole('button', { name: 'ส่งออก' })).toBeInTheDocument();
    });
  });

  describe('safe area insets', () => {
    const SIDES = ['pr-(--kcp-safe-right)', 'pl-(--kcp-safe-left)'];
    const BOTTOM = 'pb-(--kcp-safe-bottom)';

    function openAt(width: number): HTMLElement {
      installViewport(width, { reducedMotion: true });
      act(() => {
        uiStore.getState().open();
      });
      render(<Overlay />, { wrapper });
      return screen.getByRole('main');
    }

    it('pads the body clear of the side and bottom insets above 640 px', () => {
      expect(openAt(1366)).toHaveClass(...SIDES, BOTTOM);
    });

    it('leaves the bottom inset to the phone nav, which pads itself', () => {
      const main = openAt(390);
      expect(main).toHaveClass(...SIDES);
      expect(main).not.toHaveClass(BOTTOM);
    });

    it('pads the bottom inset of the phone preview, which has no nav', () => {
      openAt(390);
      act(() => {
        uiStore.getState().setViewMode('preview');
      });
      expect(screen.getByRole('main')).toHaveClass(...SIDES, BOTTOM);
    });
  });

  // The funnel writes the layout before the panel opens, so a sheet or dialog mounts in
  // the same commits as the overlay; focus must still land inside that modal layer.
  describe('opened at a target', () => {
    afterEach(() => {
      act(() => {
        revalidationStore.getState().setUpdatesOpen(false);
      });
      resetPlanStore();
    });

    it('lands focus in the catalog sheet at 768 px', () => {
      installViewport(768, { reducedMotion: true });
      render(<Overlay />, { wrapper });
      act(() => {
        openPanelAt('catalog');
      });
      const sheet = document.getElementById(CATALOG_COLUMN_ID);
      expect(sheet).toHaveAttribute('role', 'dialog');
      expect(sheet?.contains(document.activeElement)).toBe(true);
    });

    it.each([390, 1366])(
      'lands focus in the updates dialog at %i px',
      (width) => {
        installViewport(width, { reducedMotion: true });
        seedActivePlan([makePlanEntry({ verifyStatus: 'missing' })]);
        render(<Overlay />, { wrapper });
        act(() => {
          openPanelAt('updates');
        });
        const dialogs = screen.getAllByRole('dialog');
        expect(dialogs).toHaveLength(2);
        expect(dialogs[1]?.contains(document.activeElement)).toBe(true);
      },
    );
  });

  it('portals a header sheet into the panel below 640 px', () => {
    installViewport(390, { reducedMotion: true });
    act(() => {
      uiStore.getState().open();
    });
    render(<Overlay />, { wrapper });
    const panel = screen.getByRole('dialog', {
      name: 'KCP: ตัววางแผนตารางเรียน สจล.',
    });
    fireEvent.click(screen.getByRole('button', { name: PLAN_TRIGGER }));
    const sheet = screen.getByRole('dialog', { name: 'เลือกตาราง' });
    expect(panel).toContainElement(sheet);
    // The sheet sits on the panel itself, outside the header it opened from.
    expect(sheet.closest('header')).toBeNull();
  });

  it('fits the panel and its sheets above an open phone keyboard', () => {
    installViewport(390, { reducedMotion: true });
    // A phone keyboard shrinks the visual viewport only; the layout viewport the fixed
    // panel resolves against keeps its 844 px.
    const keyboard = installVisualViewport(844);
    onTestFinished(keyboard.restore);
    keyboard.height = 420;
    act(() => {
      uiStore.getState().open();
    });
    render(<Overlay />, { wrapper });
    const panel = screen.getByRole('dialog', {
      name: 'KCP: ตัววางแผนตารางเรียน สจล.',
    });
    expect(panel.style.getPropertyValue(VIEWPORT_BOTTOM_PROPERTY)).toBe(
      '424px',
    );
    expect(panel).toHaveClass(...VIEWPORT_FIT.split(' '));
    expect(panel).not.toHaveClass('inset-0');
    // The plan name field lives in a sheet on this tier, which reads the same inset.
    fireEvent.click(screen.getByRole('button', { name: PLAN_TRIGGER }));
    const layer = screen.getByRole('dialog', {
      name: 'เลือกตาราง',
    }).parentElement;
    expect(layer).toHaveClass(...VIEWPORT_FIT.split(' '));
  });
});
