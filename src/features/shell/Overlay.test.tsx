import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { CATALOG_COLUMN_ID } from './catalogVisibility';
import { Overlay } from './Overlay';
import { openPanelAt } from './openPanel';
import { uiStore } from './uiStore';
import { OVERLAY_HISTORY_MARKER } from './useBackToClose';
import { revalidationStore } from '@/features/plans/revalidationStore';
import { SearchDepsProvider } from '@/features/search/SearchDepsContext';
import { makePlanEntry } from '../../../tests/support/domain-builders';
import {
  resetPlanStore,
  seedActivePlan,
} from '../../../tests/support/plan-store';
import { fakeSearchDeps } from '../../../tests/support/searchDeps';
import { installViewport } from '../../../tests/support/viewport';

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

afterEach(async () => {
  // While the panel holds its history entry, closing it goes back through a queued
  // traversal; wait for it, so the next test opens from a settled history.
  const state: unknown = window.history.state;
  const settled =
    typeof state === 'object' &&
    state !== null &&
    OVERLAY_HISTORY_MARKER in state
      ? nextPopState()
      : Promise.resolve();
  cleanup();
  vi.unstubAllGlobals();
  act(() => {
    uiStore.getState().close();
    uiStore.getState().setLanguage('th');
    uiStore.getState().setViewMode('edit');
  });
  await settled;
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

    it('returns to the host entry when the close control is activated', async () => {
      openFrom(false);
      const popped = nextPopState();
      fireEvent.click(screen.getByRole('button', { name: 'ปิด' }));
      await act(() => popped);
      expect(uiStore.getState().isOpen).toBe(false);
      expectHostEntry();
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
      act(() => {
        uiStore.getState().setViewMode('preview');
      });
      expect(openAt(390)).toHaveClass(...SIDES, BOTTOM);
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
    fireEvent.click(screen.getByRole('button', { name: 'เลือกตาราง' }));
    const sheet = screen.getByRole('dialog', { name: 'เลือกตาราง' });
    expect(panel).toContainElement(sheet);
    // The sheet sits on the panel itself, outside the header it opened from.
    expect(sheet.closest('header')).toBeNull();
  });
});
