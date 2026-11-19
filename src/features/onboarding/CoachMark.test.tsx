import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { localDayStamp } from '@/lib/onboarding/coachMark';
import type { OnboardingRecord } from '@/lib/storage/onboarding';
import { planStore } from '@/features/plans/planStore';
import { Launcher, LAUNCHER_ID } from '@/features/shell/Launcher';
import { uiStore } from '@/features/shell/uiStore';
import { CoachMark } from './CoachMark';
import { initialOnboardingData, onboardingStore } from './onboardingStore';
import { resetPlanStore } from '../../../tests/support/plan-store';

const SELECTOR_HASH = '#/teach_table_selector';
const RESULT_HASH = '#/teach_table?mode=by_subject_owner_id&selected_year=2569';
const CALLOUT = 'ลองใช้ดูสิ';
const LATER = 'ลองภายหลัง';
const NOT_TODAY = 'ไม่แสดงอีกวันนี้';
const LAUNCHER = 'เปิด KCP: Course Planner for KMITL';
const ANNOUNCE =
  'Planner อยู่ที่มุมขวาล่างของหน้าจอ ใช้วางแผนตารางเรียนจากรายวิชาที่ค้นหาในหน้านี้';

function fakeRecord() {
  return {
    patch: vi.fn((fields: Partial<OnboardingRecord>) =>
      Promise.resolve<OnboardingRecord>({ schemaVersion: 1, ...fields }),
    ),
  };
}

function navigateTo(hash: string): void {
  act(() => {
    window.history.replaceState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

// The host router navigates with pushState and no event, then swaps its route view,
// which is all a content script observes of it (ADR-0067).
async function routerNavigate(hash: string): Promise<void> {
  await act(async () => {
    window.history.pushState(null, '', hash);
    // The swap is observed even though the view leaves again at once.
    const view = document.createElement('div');
    document.body.append(view);
    view.remove();
    await Promise.resolve();
  });
}

function settle(record: OnboardingRecord = { schemaVersion: 1 }): void {
  act(() => {
    const store = onboardingStore.getState();
    store.hydrate(null, record);
    store.settleHandshake();
    store.settleWelcome();
  });
}

// The coach mark mounts before the launcher, as the app mounts them, so the Tab cycle
// and the focus hand back find the launcher where they do in the shadow root.
function renderCoachMark(record = fakeRecord()) {
  const view = render(
    <>
      <CoachMark record={record} />
      <Launcher />
    </>,
  );
  return { ...view, record };
}

function dialog(): HTMLElement {
  return screen.getByRole('dialog', { name: CALLOUT });
}

function launcher(): HTMLElement {
  return screen.getByRole('button', { name: LAUNCHER });
}

beforeEach(() => {
  window.history.replaceState(null, '', SELECTOR_HASH);
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '#');
  act(() => {
    uiStore.getState().close();
    uiStore.getState().setLanguage('th');
  });
  onboardingStore.setState(initialOnboardingData());
  resetPlanStore();
  planStore.setState({ loaded: false });
});

describe('CoachMark showing', () => {
  it('waits for the reads and the first run decisions to settle', () => {
    renderCoachMark();
    expect(screen.queryByRole('dialog')).toBeNull();
    settle();
    expect(dialog()).toBeInTheDocument();
    expect(onboardingStore.getState().coachMarkOpen).toBe(true);
  });

  it('is a non modal dialog labelled by the callout, with focus on Maybe later', () => {
    renderCoachMark();
    settle();
    expect(dialog()).toHaveAttribute('aria-modal', 'false');
    expect(within(dialog()).getByRole('button', { name: LATER })).toHaveFocus();
  });

  it('announces where the planner is in a polite region mounted empty from the start', () => {
    const { container } = renderCoachMark();
    const region = container.querySelector('[aria-live="polite"]');
    expect(region).toBeEmptyDOMElement();
    expect(region).toHaveAttribute('lang', 'th');
    settle();
    expect(region).toHaveTextContent(ANNOUNCE);
  });

  it('shows nothing off the search route', () => {
    window.history.replaceState(null, '', RESULT_HASH);
    renderCoachMark();
    settle();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows when a hash change makes the search route active', () => {
    window.history.replaceState(null, '', RESULT_HASH);
    renderCoachMark();
    settle();
    navigateTo(SELECTOR_HASH);
    expect(dialog()).toBeInTheDocument();
  });

  it('stays away on the day the student chose not again today', () => {
    renderCoachMark();
    settle({
      schemaVersion: 1,
      coachMarkSnoozedOn: localDayStamp(new Date()),
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('stays away in a document that found the welcome pending', () => {
    renderCoachMark();
    act(() => {
      onboardingStore.getState().suppressDocument();
    });
    settle();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('stays away while the welcome is open', () => {
    renderCoachMark();
    act(() => {
      onboardingStore.getState().setWelcomeOpen(true);
    });
    settle();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('CoachMark dismissing', () => {
  it('hides for the visit on Maybe later, hands focus to the launcher, and returns on the next visit', () => {
    const { record } = renderCoachMark();
    settle();
    fireEvent.click(within(dialog()).getByRole('button', { name: LATER }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(launcher()).toHaveFocus();
    expect(record.patch).not.toHaveBeenCalled();
    expect(onboardingStore.getState().coachMarkOpen).toBe(false);

    navigateTo(RESULT_HASH);
    navigateTo(SELECTOR_HASH);
    expect(dialog()).toBeInTheDocument();
  });

  it('returns on the next visit when the host router navigates with pushState', async () => {
    renderCoachMark();
    settle();
    fireEvent.click(within(dialog()).getByRole('button', { name: LATER }));
    expect(screen.queryByRole('dialog')).toBeNull();

    await routerNavigate(RESULT_HASH);
    expect(screen.queryByRole('dialog')).toBeNull();
    await routerNavigate(SELECTOR_HASH);
    expect(dialog()).toBeInTheDocument();
    await routerNavigate(RESULT_HASH);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('hides on Not again today and records the local day', () => {
    const { record } = renderCoachMark();
    settle();
    fireEvent.click(within(dialog()).getByRole('button', { name: NOT_TODAY }));
    expect(screen.queryByRole('dialog')).toBeNull();
    const today = localDayStamp(new Date());
    expect(record.patch).toHaveBeenCalledWith({ coachMarkSnoozedOn: today });
    expect(onboardingStore.getState().record.coachMarkSnoozedOn).toBe(today);

    // The day holds across visits of the route.
    navigateTo(RESULT_HASH);
    navigateTo(SELECTOR_HASH);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('hides on Escape, from inside it or from the launcher', () => {
    renderCoachMark();
    settle();
    fireEvent.keyDown(within(dialog()).getByRole('button', { name: LATER }), {
      key: 'Escape',
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(launcher()).toHaveFocus();

    navigateTo(RESULT_HASH);
    navigateTo(SELECTOR_HASH);
    launcher().focus();
    fireEvent.keyDown(launcher(), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('hides on a press on the scrim, which is neither a tab stop nor announced', () => {
    const { container } = renderCoachMark();
    settle();
    const scrim = container.querySelector('[data-coach-mark-scrim]');
    if (scrim === null) throw new Error('no scrim');
    expect(scrim).toHaveAttribute('tabindex', '-1');
    expect(scrim).toHaveAttribute('aria-hidden', 'true');
    fireEvent.click(scrim);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('hides when the launcher opens the panel, and stays away after it closes', () => {
    renderCoachMark();
    settle();
    fireEvent.click(launcher());
    expect(uiStore.getState().isOpen).toBe(true);
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => {
      uiStore.getState().close();
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('hides when the host navigates away, handing focus to the launcher', () => {
    renderCoachMark();
    settle();
    expect(within(dialog()).getByRole('button', { name: LATER })).toHaveFocus();
    navigateTo(RESULT_HASH);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(launcher()).toHaveFocus();
  });
});

describe('CoachMark keyboard cycle', () => {
  it('cycles Tab through the two buttons and the launcher', () => {
    renderCoachMark();
    settle();
    const notToday = within(dialog()).getByRole('button', { name: NOT_TODAY });
    launcher().focus();
    fireEvent.keyDown(launcher(), { key: 'Tab' });
    expect(notToday).toHaveFocus();
    fireEvent.keyDown(notToday, { key: 'Tab', shiftKey: true });
    expect(launcher()).toHaveFocus();
    expect(document.getElementById(LAUNCHER_ID)).toBe(launcher());
  });

  it('keeps the launcher live with no ring while it shows, and rings it after Maybe later', () => {
    act(() => {
      planStore.setState({ loaded: true });
    });
    renderCoachMark();
    settle();
    expect(launcher()).not.toHaveAttribute('inert');
    expect(launcher()).not.toHaveAttribute('aria-hidden');
    expect(launcher().className).not.toContain('kcp-launcher-ring');
    fireEvent.click(within(dialog()).getByRole('button', { name: LATER }));
    expect(launcher().className).toContain('kcp-launcher-ring');
  });
});
