import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import {
  ENTRY_TOAST_DELAY_MS,
  ENTRY_TOAST_VISIBLE_MS,
} from '@/lib/onboarding/entryToast';
import type { OnboardingRecord } from '@/lib/storage/onboarding';
import { planStore } from '@/features/plans/planStore';
import { revalidationStore } from '@/features/plans/revalidationStore';
import { Launcher, LAUNCHER_ID } from '@/features/shell/Launcher';
import { uiStore } from '@/features/shell/uiStore';
import { makePlanEntry } from '../../../tests/support/domain-builders';
import {
  resetPlanStore,
  seedActivePlan,
} from '../../../tests/support/plan-store';
import { reviewedEntry } from '../../../tests/support/review';
import { installViewport } from '../../../tests/support/viewport';
import { EntryToast } from './EntryToast';
import { initialOnboardingData, onboardingStore } from './onboardingStore';

const NO_PLAN =
  'ใช้ Planner วางแผนตารางเรียนจากรายวิชาที่เปิดสอนในเว็บไซต์นี้ได้';
const CLOSE = 'ปิดข้อความนี้';
const OPT_OUT = 'ไม่ต้องแสดงข้อความนี้อีก';

function fakeRecord() {
  return {
    patch: vi.fn((fields: Partial<OnboardingRecord>) =>
      Promise.resolve<OnboardingRecord>({ schemaVersion: 1, ...fields }),
    ),
  };
}

function settle(): void {
  act(() => {
    planStore.setState({ loaded: true });
    const store = onboardingStore.getState();
    store.hydrate(null, { schemaVersion: 1 });
    store.settleHandshake();
    store.settleWelcome();
  });
}

function show(): void {
  settle();
  act(() => {
    vi.advanceTimersByTime(ENTRY_TOAST_DELAY_MS);
  });
}

function liveRegion(container: HTMLElement): HTMLElement {
  const region = container.querySelector<HTMLElement>('[aria-live]');
  if (region === null) throw new Error('The entry toast region is not mounted');
  return region;
}

beforeEach(() => {
  vi.useFakeTimers();
  installViewport(390);
  uiStore.setState({
    isOpen: false,
    viewMode: 'preview',
    mobilePane: 'plan',
    planView: 'selected',
  });
  revalidationStore.getState().setUpdatesOpen(false);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  act(() => {
    uiStore.getState().close();
    uiStore.getState().setLanguage('th');
  });
  revalidationStore.getState().setUpdatesOpen(false);
  onboardingStore.setState(initialOnboardingData());
  resetPlanStore();
  planStore.setState({ loaded: false });
});

describe('EntryToast region', () => {
  it('keeps an empty polite region in the panel language before the show', () => {
    const { container } = render(<EntryToast record={fakeRecord()} />);
    const region = liveRegion(container);
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('aria-atomic', 'true');
    expect(region).toHaveAttribute('lang', 'th');
    expect(region).toBeEmptyDOMElement();

    show();
    expect(liveRegion(container)).toBe(region);
    expect(region).toHaveTextContent(NO_PLAN);
    act(() => {
      uiStore.getState().setLanguage('en');
    });
    expect(region).toHaveAttribute('lang', 'en');
  });

  it('never moves focus when it shows', () => {
    const outside = document.createElement('button');
    document.body.append(outside);
    const host = document.createElement('div');
    document.body.append(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const mount = document.createElement('div');
    shadow.append(mount);
    try {
      outside.focus();
      render(<EntryToast record={fakeRecord()} />, { container: mount });
      show();
      expect(within(mount).getByText(NO_PLAN)).toBeInTheDocument();
      expect(document.activeElement).toBe(outside);
      expect(shadow.activeElement).toBeNull();
    } finally {
      host.remove();
      outside.remove();
    }
  });

  it('enters with the toast entrance, which reduced motion removes', () => {
    const { container } = render(<EntryToast record={fakeRecord()} />);
    show();
    expect(container.querySelector('[data-entry-toast]')).toHaveClass(
      'kcp-toast-enter',
    );
    const css = readFileSync(
      resolve(process.cwd(), 'src/entrypoints/regis.content/style.css'),
      'utf8',
    );
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\s*\.kcp-toast-enter \{\s*animation: none;/,
    );
  });
});

describe('EntryToast dismissal', () => {
  it('hides for the document on close', () => {
    const record = fakeRecord();
    render(<EntryToast record={record} />);
    show();
    fireEvent.click(screen.getByRole('button', { name: CLOSE }));
    expect(screen.queryByText(NO_PLAN)).toBeNull();
    act(() => {
      vi.advanceTimersByTime(ENTRY_TOAST_DELAY_MS + ENTRY_TOAST_VISIBLE_MS);
    });
    expect(screen.queryByText(NO_PLAN)).toBeNull();
    expect(record.patch).not.toHaveBeenCalled();
  });

  it('closes on Escape with focus inside and hands focus to the launcher', () => {
    render(
      <>
        <Launcher />
        <EntryToast record={fakeRecord()} />
      </>,
    );
    show();
    const close = screen.getByRole('button', { name: CLOSE });
    close.focus();
    fireEvent.keyDown(close, { key: 'Escape' });
    expect(screen.queryByText(NO_PLAN)).toBeNull();
    expect(document.activeElement?.id).toBe(LAUNCHER_ID);
  });

  it('records the opt out and hides on Do not show again', async () => {
    const record = fakeRecord();
    render(<EntryToast record={record} />);
    show();
    fireEvent.click(screen.getByRole('button', { name: OPT_OUT }));
    expect(screen.queryByText(NO_PLAN)).toBeNull();
    expect(record.patch).toHaveBeenCalledTimes(1);
    const fields = record.patch.mock.calls[0]?.[0];
    expect(fields?.entryToastOptOutAt).toEqual(expect.any(String));
    expect(onboardingStore.getState().record.entryToastOptOutAt).toBeDefined();
    await act(async () => {
      await Promise.resolve();
    });
    expect(onboardingStore.getState().record.entryToastOptOutAt).toBe(
      fields?.entryToastOptOutAt,
    );
  });

  it('hides when the panel opens and stays hidden after it closes', () => {
    render(<EntryToast record={fakeRecord()} />);
    show();
    act(() => {
      uiStore.getState().open();
    });
    expect(screen.queryByText(NO_PLAN)).toBeNull();
    act(() => {
      uiStore.getState().close();
      vi.advanceTimersByTime(ENTRY_TOAST_DELAY_MS + ENTRY_TOAST_VISIBLE_MS);
    });
    expect(screen.queryByText(NO_PLAN)).toBeNull();
  });
});

describe('EntryToast actions', () => {
  function pressAction(name: string): void {
    render(<EntryToast record={fakeRecord()} />);
    show();
    fireEvent.click(screen.getByRole('button', { name }));
  }

  it('opens the catalog in edit when there is no plan', () => {
    pressAction('เปิด Planner');
    const ui = uiStore.getState();
    expect(ui.isOpen).toBe(true);
    expect(ui.viewMode).toBe('edit');
    expect(ui.mobilePane).toBe('catalog');
  });

  it('opens the catalog in edit for an empty plan', () => {
    act(() => {
      seedActivePlan([]);
    });
    pressAction('เพิ่มวิชา');
    const ui = uiStore.getState();
    expect(ui.isOpen).toBe(true);
    expect(ui.viewMode).toBe('edit');
    expect(ui.mobilePane).toBe('catalog');
  });

  it('opens the timetable for a plan with subjects', () => {
    act(() => {
      seedActivePlan([makePlanEntry()]);
    });
    pressAction('เปิดตาราง');
    const ui = uiStore.getState();
    expect(ui.isOpen).toBe(true);
    expect(ui.mobilePane).toBe('plan');
    expect(ui.planView).toBe('timetable');
    expect(revalidationStore.getState().updatesOpen).toBe(false);
  });

  it('opens the timetable in edit with the updates dialog for changes to review', () => {
    act(() => {
      seedActivePlan([reviewedEntry('1')]);
    });
    pressAction('ตรวจสอบ');
    const ui = uiStore.getState();
    expect(ui.isOpen).toBe(true);
    expect(ui.viewMode).toBe('edit');
    expect(ui.planView).toBe('timetable');
    expect(revalidationStore.getState().updatesOpen).toBe(true);
  });
});
