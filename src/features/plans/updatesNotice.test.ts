import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import {
  resetPlanStore,
  seedActivePlan,
} from '../../../tests/support/plan-store';
import { notifiedAtOf, reviewedEntry } from '../../../tests/support/review';
import { uiStore } from '@/features/shell/uiStore';
import { revalidationStore } from './revalidationStore';
import { noticeNewReviews, openUpdatesDialog } from './updatesNotice';

const SHOWN_AT = '2026-11-06T01:00:00.000Z';

beforeEach(() => {
  uiStore.setState({ isOpen: true, viewMode: 'edit' });
});

afterEach(() => {
  resetPlanStore();
  revalidationStore.setState({
    runs: {},
    updatesOpen: false,
    pendingOpen: null,
  });
  uiStore.setState({ isOpen: false, viewMode: 'edit' });
});

describe('noticeNewReviews', () => {
  it('asks for the dialog after a complete automatic run with new items', () => {
    seedActivePlan([reviewedEntry('1')], { id: 'p1' });
    noticeNewReviews('p1', 'done', false);
    expect(revalidationStore.getState().pendingOpen).toBe('p1');
    expect(revalidationStore.getState().updatesOpen).toBe(false);
  });

  it('never asks after an offline or partial run', () => {
    seedActivePlan([reviewedEntry('1')], { id: 'p1' });
    noticeNewReviews('p1', 'offline', false);
    noticeNewReviews('p1', 'partial', false);
    noticeNewReviews('p1', 'partial', true);
    expect(revalidationStore.getState().pendingOpen).toBeNull();
    expect(revalidationStore.getState().updatesOpen).toBe(false);
  });

  it('asks nothing when every item was already shown', () => {
    seedActivePlan([reviewedEntry('1', SHOWN_AT)], { id: 'p1' });
    noticeNewReviews('p1', 'done', false);
    noticeNewReviews('p1', 'done', true);
    expect(revalidationStore.getState().pendingOpen).toBeNull();
    expect(revalidationStore.getState().updatesOpen).toBe(false);
  });

  it('opens the dialog directly after a manual check in edit', () => {
    seedActivePlan([reviewedEntry('1')], { id: 'p1' });
    noticeNewReviews('p1', 'done', true);
    expect(revalidationStore.getState().updatesOpen).toBe(true);
    expect(notifiedAtOf('1')).not.toBeNull();
  });

  it('leaves a manual check in preview to the next idle moment in edit', () => {
    seedActivePlan([reviewedEntry('1')], { id: 'p1' });
    uiStore.setState({ viewMode: 'preview' });
    noticeNewReviews('p1', 'done', true);
    expect(revalidationStore.getState().updatesOpen).toBe(false);
    expect(revalidationStore.getState().pendingOpen).toBe('p1');
  });

  it('asks nothing while the dialog is already open', () => {
    seedActivePlan([reviewedEntry('1')], { id: 'p1' });
    revalidationStore.setState({ updatesOpen: true });
    noticeNewReviews('p1', 'done', false);
    expect(revalidationStore.getState().pendingOpen).toBeNull();
  });
});

describe('openUpdatesDialog', () => {
  it('opens the dialog, settles the request, and marks the new items shown', () => {
    seedActivePlan([reviewedEntry('1')], { id: 'p1' });
    revalidationStore.getState().requestOpen('p1');
    openUpdatesDialog();
    expect(revalidationStore.getState().updatesOpen).toBe(true);
    expect(revalidationStore.getState().pendingOpen).toBeNull();
    expect(notifiedAtOf('1')).not.toBeNull();
  });

  it('drops the request and stays closed with no new item left', () => {
    seedActivePlan([reviewedEntry('1', SHOWN_AT)], { id: 'p1' });
    revalidationStore.getState().requestOpen('p1');
    openUpdatesDialog();
    expect(revalidationStore.getState().updatesOpen).toBe(false);
    expect(revalidationStore.getState().pendingOpen).toBeNull();
    expect(notifiedAtOf('1')).toBe(SHOWN_AT);
  });
});
