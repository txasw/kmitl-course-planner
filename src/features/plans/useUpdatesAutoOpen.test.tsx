import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { makeCourse, makePlan } from '../../../tests/support/domain-builders';
import {
  resetPlanStore,
  seedActivePlan,
} from '../../../tests/support/plan-store';
import { notifiedAtOf, reviewedEntry } from '../../../tests/support/review';
import { installViewport } from '../../../tests/support/viewport';
import { dragStore } from '@/features/planner/dragStore';
import { attentionStore } from '@/features/shell/attentionStore';
import { uiStore } from '@/features/shell/uiStore';
import { planStore } from './planStore';
import { revalidationStore } from './revalidationStore';
import { IDLE_SETTLE_MS, useUpdatesAutoOpen } from './useUpdatesAutoOpen';

const SHOWN_AT = '2026-11-06T01:00:00.000Z';

/** Request the dialog for an active plan holding one new item, with the hook mounted. */
function requestWithNewItem(): void {
  seedActivePlan([reviewedEntry('1')], { id: 'p1' });
  renderHook(() => {
    useUpdatesAutoOpen();
  });
  act(() => {
    revalidationStore.getState().requestOpen('p1');
  });
}

function isOpen(): boolean {
  return revalidationStore.getState().updatesOpen;
}

function settle(): void {
  act(() => {
    vi.advanceTimersByTime(IDLE_SETTLE_MS);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  uiStore.setState({ isOpen: true, viewMode: 'edit' });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  resetPlanStore();
  dragStore.setState({ courseDrag: null });
  attentionStore.setState({ openSurfaces: 0, searchFocused: false });
  revalidationStore.setState({
    runs: {},
    updatesOpen: false,
    pendingOpen: null,
  });
  uiStore.setState({
    isOpen: false,
    viewMode: 'edit',
    sheetOpen: false,
    mobilePane: null,
  });
});

describe('useUpdatesAutoOpen', () => {
  it('opens the dialog once the panel stays idle and marks the items shown', () => {
    seedActivePlan([reviewedEntry('1')], { id: 'p1' });
    renderHook(() => {
      useUpdatesAutoOpen();
    });
    act(() => {
      revalidationStore.getState().requestOpen('p1');
    });
    act(() => {
      vi.advanceTimersByTime(IDLE_SETTLE_MS - 1);
    });
    expect(revalidationStore.getState().updatesOpen).toBe(false);
    settle();
    expect(revalidationStore.getState().updatesOpen).toBe(true);
    expect(revalidationStore.getState().pendingOpen).toBeNull();
    expect(notifiedAtOf('1')).not.toBeNull();
  });

  it('waits in preview and opens at the next idle moment in edit', () => {
    seedActivePlan([reviewedEntry('1')], { id: 'p1' });
    uiStore.setState({ viewMode: 'preview' });
    renderHook(() => {
      useUpdatesAutoOpen();
    });
    act(() => {
      revalidationStore.getState().requestOpen('p1');
    });
    settle();
    expect(revalidationStore.getState().updatesOpen).toBe(false);
    act(() => {
      uiStore.setState({ viewMode: 'edit' });
    });
    settle();
    expect(revalidationStore.getState().updatesOpen).toBe(true);
  });

  it('waits while the overlay is closed', () => {
    seedActivePlan([reviewedEntry('1')], { id: 'p1' });
    uiStore.setState({ isOpen: false });
    renderHook(() => {
      useUpdatesAutoOpen();
    });
    act(() => {
      revalidationStore.getState().requestOpen('p1');
    });
    settle();
    expect(revalidationStore.getState().updatesOpen).toBe(false);
    expect(revalidationStore.getState().pendingOpen).toBe('p1');
  });

  it('drops a request for a plan that is no longer active', () => {
    const other = makePlan({ id: 'p2', entries: [] });
    seedActivePlan([reviewedEntry('1')], { id: 'p1' });
    planStore.setState((state) => ({ plans: [...state.plans, other] }));
    renderHook(() => {
      useUpdatesAutoOpen();
    });
    act(() => {
      revalidationStore.getState().requestOpen('p1');
      planStore.setState({ activePlanId: 'p2', entries: [] });
    });
    settle();
    expect(revalidationStore.getState().updatesOpen).toBe(false);
    expect(revalidationStore.getState().pendingOpen).toBeNull();
  });

  it('stays closed when every item was already shown', () => {
    seedActivePlan([reviewedEntry('1', SHOWN_AT)], { id: 'p1' });
    renderHook(() => {
      useUpdatesAutoOpen();
    });
    act(() => {
      revalidationStore.getState().requestOpen('p1');
    });
    settle();
    expect(revalidationStore.getState().updatesOpen).toBe(false);
    expect(revalidationStore.getState().pendingOpen).toBeNull();
    expect(notifiedAtOf('1')).toBe(SHOWN_AT);
  });

  it('waits for a drag to end, then for the settle', () => {
    dragStore.setState({
      courseDrag: { course: makeCourse(), candidates: [] },
    });
    requestWithNewItem();
    settle();
    expect(isOpen()).toBe(false);
    act(() => {
      dragStore.setState({ courseDrag: null });
    });
    expect(isOpen()).toBe(false);
    settle();
    expect(isOpen()).toBe(true);
  });

  it('waits while a popover, menu, sheet, or dialog is open', () => {
    const release = attentionStore.getState().openSurface();
    requestWithNewItem();
    settle();
    expect(isOpen()).toBe(false);
    act(release);
    settle();
    expect(isOpen()).toBe(true);
  });

  it('waits while focus is inside the search form', () => {
    attentionStore.setState({ searchFocused: true });
    requestWithNewItem();
    settle();
    expect(isOpen()).toBe(false);
    act(() => {
      attentionStore.setState({ searchFocused: false });
    });
    settle();
    expect(isOpen()).toBe(true);
  });

  it('restarts the settle when the student turns busy before it ends', () => {
    requestWithNewItem();
    act(() => {
      vi.advanceTimersByTime(IDLE_SETTLE_MS - 100);
    });
    let release = (): void => undefined;
    act(() => {
      release = attentionStore.getState().openSurface();
    });
    act(release);
    act(() => {
      vi.advanceTimersByTime(IDLE_SETTLE_MS - 100);
    });
    expect(isOpen()).toBe(false);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(isOpen()).toBe(true);
  });

  it('waits while the catalog sheet covers the grid on the medium tier', () => {
    installViewport(768);
    uiStore.setState({ sheetOpen: true });
    requestWithNewItem();
    settle();
    expect(isOpen()).toBe(false);
    act(() => {
      uiStore.setState({ sheetOpen: false });
    });
    settle();
    expect(isOpen()).toBe(true);
  });

  it('waits while the catalog pane hides the grid on the phone tier', () => {
    uiStore.setState({ mobilePane: 'catalog' });
    requestWithNewItem();
    settle();
    expect(isOpen()).toBe(false);
    act(() => {
      uiStore.setState({ mobilePane: 'plan' });
    });
    settle();
    expect(isOpen()).toBe(true);
  });
});
