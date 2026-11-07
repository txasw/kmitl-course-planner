import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import { App } from './App';
import { uiStore } from '@/features/shell/uiStore';
import {
  initialOnboardingData,
  onboardingStore,
} from '@/features/onboarding/onboardingStore';
import { applyRequestedOpen } from '@/features/onboarding/useWorkerHandshake';
import { planStore } from '@/features/plans/planStore';
import { ENTRY_TOAST_DELAY_MS } from '@/lib/onboarding/entryToast';
import type { PrefsRepository } from '@/lib/storage/prefs';
import { fakeSearchDeps } from '../../../tests/support/searchDeps';
import { fakePlanDeps } from '../../../tests/support/planDeps';
import {
  fakeHandshakeDeps,
  fakeOnboardingDeps,
  fakeWelcomeDeps,
} from '../../../tests/support/onboardingDeps';

function noopRepo(): PrefsRepository {
  return {
    load: () => Promise.resolve(null),
    save: () => Promise.resolve(),
  };
}

afterEach(() => {
  cleanup();
  act(() => {
    uiStore.getState().close();
    uiStore.getState().setLanguage('th');
  });
  vi.useRealTimers();
  onboardingStore.setState(initialOnboardingData());
  planStore.setState({ loaded: false });
  document.documentElement.style.overflow = '';
});

function renderApp(): void {
  render(
    <App
      prefs={noopRepo()}
      plans={fakePlanDeps()}
      search={fakeSearchDeps()}
      onboarding={fakeOnboardingDeps()}
      handshake={fakeHandshakeDeps()}
      welcome={fakeWelcomeDeps()}
    />,
  );
}

const LAUNCHER = 'เปิด KCP: Course Planner for KMITL';
const WELCOME = 'ขอบคุณที่ติดตั้ง KCP: Course Planner for KMITL';

function showWelcome(): void {
  act(() => {
    onboardingStore.getState().setWelcomeOpen(true);
  });
}

describe('App', () => {
  it('shows the launcher and opens the overlay on activation', () => {
    render(
      <App
        prefs={noopRepo()}
        plans={fakePlanDeps()}
        search={fakeSearchDeps()}
        onboarding={fakeOnboardingDeps()}
        handshake={fakeHandshakeDeps()}
        welcome={fakeWelcomeDeps()}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'เปิด KCP: Course Planner for KMITL',
      }),
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('makes the launcher inert and hidden while the overlay is open', () => {
    render(
      <App
        prefs={noopRepo()}
        plans={fakePlanDeps()}
        search={fakeSearchDeps()}
        onboarding={fakeOnboardingDeps()}
        handshake={fakeHandshakeDeps()}
        welcome={fakeWelcomeDeps()}
      />,
    );
    const launcher = screen.getByRole('button', {
      name: 'เปิด KCP: Course Planner for KMITL',
    });
    act(() => {
      uiStore.getState().open();
    });
    expect(launcher).toHaveAttribute('inert');
    expect(launcher).toHaveAttribute('aria-hidden', 'true');
  });

  it('opens the panel from Start planning and the overlay trap holds focus', () => {
    renderApp();
    showWelcome();
    expect(screen.getByRole('dialog', { name: WELCOME })).toBeInTheDocument();
    expect(document.documentElement.style.overflow).toBe('hidden');
    fireEvent.click(screen.getByRole('button', { name: 'เริ่มวางแผน' }));
    expect(screen.queryByRole('dialog', { name: WELCOME })).toBeNull();
    const overlay = screen.getByRole('dialog');
    expect(overlay).toContainElement(
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null,
    );
    expect(document.documentElement.style.overflow).toBe('hidden');
    act(() => {
      uiStore.getState().close();
    });
    expect(screen.getByRole('button', { name: LAUNCHER })).toHaveFocus();
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('closes the welcome for a worker open and keeps the host locked', () => {
    renderApp();
    showWelcome();
    act(() => {
      applyRequestedOpen();
    });
    expect(screen.queryByRole('dialog', { name: WELCOME })).toBeNull();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(document.documentElement.style.overflow).toBe('hidden');
  });

  it('keeps the launcher inert under the welcome', () => {
    renderApp();
    const launcher = screen.getByRole('button', { name: LAUNCHER });
    showWelcome();
    expect(launcher).toHaveAttribute('inert');
  });

  it('places the entry toast right after the launcher in the tab order', () => {
    vi.useFakeTimers();
    renderApp();
    act(() => {
      planStore.setState({ loaded: true });
      const store = onboardingStore.getState();
      store.hydrate(null, { schemaVersion: 1 });
      store.settleHandshake();
      store.settleWelcome();
    });
    act(() => {
      vi.advanceTimersByTime(ENTRY_TOAST_DELAY_MS);
    });
    const buttons = screen.getAllByRole('button');
    const launcher = screen.getByRole('button', { name: LAUNCHER });
    const action = screen.getByRole('button', { name: 'เปิด Planner' });
    expect(buttons.indexOf(action)).toBe(buttons.indexOf(launcher) + 1);
  });
});
