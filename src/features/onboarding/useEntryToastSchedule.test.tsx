import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  ENTRY_TOAST_DELAY_MS,
  ENTRY_TOAST_VISIBLE_MS,
} from '@/lib/onboarding/entryToast';
import { planStore } from '@/features/plans/planStore';
import { uiStore } from '@/features/shell/uiStore';
import { makePlanEntry } from '../../../tests/support/domain-builders';
import {
  resetPlanStore,
  seedActivePlan,
} from '../../../tests/support/plan-store';
import { initialOnboardingData, onboardingStore } from './onboardingStore';
import { useEntryToastSchedule } from './useEntryToastSchedule';

let visibility: DocumentVisibilityState = 'visible';

function setVisibility(next: DocumentVisibilityState): void {
  visibility = next;
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

/** Settles everything the schedule waits on: the plan read, the onboarding read, the
 * handshake and the welcome decision. */
function settle(): void {
  act(() => {
    planStore.setState({ loaded: true });
    const store = onboardingStore.getState();
    store.hydrate(null, { schemaVersion: 1 });
    store.settleHandshake();
    store.settleWelcome();
  });
}

function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function renderSchedule(held = false) {
  return renderHook(({ hold }) => useEntryToastSchedule(hold), {
    initialProps: { hold: held },
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  visibility = 'visible';
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(
    () => visibility,
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  act(() => {
    uiStore.getState().close();
  });
  onboardingStore.setState(initialOnboardingData());
  resetPlanStore();
  planStore.setState({ loaded: false });
});

describe('useEntryToastSchedule timing', () => {
  it('shows nothing before everything settles', () => {
    const { result } = renderSchedule();
    advance(ENTRY_TOAST_DELAY_MS * 3);
    expect(result.current.content).toBeNull();
  });

  it('waits the delay after settling, then shows and hides after its life', () => {
    const { result } = renderSchedule();
    settle();
    advance(ENTRY_TOAST_DELAY_MS - 1);
    expect(result.current.content).toBeNull();
    advance(1);
    expect(result.current.content?.kind).toBe('noPlan');
    advance(ENTRY_TOAST_VISIBLE_MS - 1);
    expect(result.current.content).not.toBeNull();
    advance(1);
    expect(result.current.content).toBeNull();
  });

  it('starts the delay only once the document is visible', () => {
    visibility = 'hidden';
    const { result } = renderSchedule();
    settle();
    advance(ENTRY_TOAST_DELAY_MS * 3);
    expect(result.current.content).toBeNull();
    setVisibility('visible');
    advance(ENTRY_TOAST_DELAY_MS - 1);
    expect(result.current.content).toBeNull();
    advance(1);
    expect(result.current.content?.kind).toBe('noPlan');
  });

  it('starts the delay again when the document turns hidden during it', () => {
    const { result } = renderSchedule();
    settle();
    advance(ENTRY_TOAST_DELAY_MS - 500);
    setVisibility('hidden');
    advance(ENTRY_TOAST_DELAY_MS);
    setVisibility('visible');
    advance(ENTRY_TOAST_DELAY_MS - 1);
    expect(result.current.content).toBeNull();
    advance(1);
    expect(result.current.content).not.toBeNull();
  });

  it('pauses the hide while held and restarts the full life on release', () => {
    const { result, rerender } = renderSchedule();
    settle();
    advance(ENTRY_TOAST_DELAY_MS);
    advance(ENTRY_TOAST_VISIBLE_MS - 1000);
    rerender({ hold: true });
    advance(ENTRY_TOAST_VISIBLE_MS * 2);
    expect(result.current.content).not.toBeNull();
    rerender({ hold: false });
    advance(ENTRY_TOAST_VISIBLE_MS - 1);
    expect(result.current.content).not.toBeNull();
    advance(1);
    expect(result.current.content).toBeNull();
  });
});

describe('useEntryToastSchedule once per document', () => {
  it('never swaps or brings back the message on a hash change or popstate', () => {
    const { result } = renderSchedule();
    settle();
    advance(ENTRY_TOAST_DELAY_MS);
    const shown = result.current.content;
    expect(shown?.kind).toBe('noPlan');

    act(() => {
      seedActivePlan([makePlanEntry()]);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(result.current.content).toBe(shown);

    advance(ENTRY_TOAST_VISIBLE_MS);
    expect(result.current.content).toBeNull();
    act(() => {
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    advance(ENTRY_TOAST_DELAY_MS + ENTRY_TOAST_VISIBLE_MS);
    expect(result.current.content).toBeNull();
  });

  it('chooses the content from the plan as it stands when the wait ends', () => {
    const { result } = renderSchedule();
    settle();
    act(() => {
      seedActivePlan([makePlanEntry()]);
    });
    advance(ENTRY_TOAST_DELAY_MS);
    expect(result.current.content?.kind).toBe('plan');
  });

  it.each([
    [
      'found the welcome pending at load',
      () => {
        onboardingStore.getState().hydrate(
          {
            schemaVersion: 1,
            installedAt: '2026-11-06T00:00:00.000Z',
            version: '1.4.0',
          },
          { schemaVersion: 1 },
        );
      },
    ],
    [
      'showed the welcome',
      () => {
        onboardingStore.getState().suppressDocument();
      },
    ],
    [
      'applied a requested open',
      () => {
        onboardingStore.getState().markOpenRequested();
      },
    ],
  ])('shows nothing in a document that %s', (_label, mark) => {
    act(mark);
    const { result } = renderSchedule();
    settle();
    advance(ENTRY_TOAST_DELAY_MS + ENTRY_TOAST_VISIBLE_MS);
    expect(result.current.content).toBeNull();
  });

  it('hides on a panel open and stays hidden after the panel closes', () => {
    const { result } = renderSchedule();
    settle();
    advance(ENTRY_TOAST_DELAY_MS);
    expect(result.current.content).not.toBeNull();
    act(() => {
      uiStore.getState().open();
    });
    expect(result.current.content).toBeNull();
    act(() => {
      uiStore.getState().close();
    });
    advance(ENTRY_TOAST_DELAY_MS + ENTRY_TOAST_VISIBLE_MS);
    expect(result.current.content).toBeNull();
  });

  it('never shows once the panel opened during the wait', () => {
    const { result } = renderSchedule();
    settle();
    act(() => {
      uiStore.getState().open();
      uiStore.getState().close();
    });
    advance(ENTRY_TOAST_DELAY_MS + ENTRY_TOAST_VISIBLE_MS);
    expect(result.current.content).toBeNull();
  });

  it('ends for the document when the caller hides it', () => {
    const { result } = renderSchedule();
    settle();
    advance(ENTRY_TOAST_DELAY_MS);
    act(() => {
      result.current.end();
    });
    expect(result.current.content).toBeNull();
    advance(ENTRY_TOAST_DELAY_MS + ENTRY_TOAST_VISIBLE_MS);
    expect(result.current.content).toBeNull();
  });
});
