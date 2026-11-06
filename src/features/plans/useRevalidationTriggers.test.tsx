import { describe, it, expect, afterEach } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { ok, err, networkError, type Result } from '@/lib/utils/result';
import type { NormalizedCatalog } from '@/lib/domain/normalize';
import type { PlanEntry, SourceQuery } from '@/lib/domain/plan';
import type { TypedSend } from '@/lib/messaging/sendTyped';
import {
  makeCourse,
  makeMeeting,
  makePlanEntry,
  makeSection,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import {
  resetPlanStore,
  seedActivePlan,
} from '../../../tests/support/plan-store';
import { uiStore } from '@/features/shell/uiStore';
import { planStore } from './planStore';
import { revalidationStore } from './revalidationStore';
import { useRevalidationTriggers } from './useRevalidationTriggers';

function sourceQuery(): SourceQuery {
  return {
    endpoint: 'get-teach-table-show',
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
}

function placed(review?: PlanEntry['review']): PlanEntry {
  const snapshot = makeSnapshot({
    teachTableId: 't1',
    subjectId: '90000001',
    section: '901',
  });
  return makePlanEntry({
    snapshot,
    sourceQuery: sourceQuery(),
    ...(review === undefined ? {} : { review, verifyStatus: 'changed' }),
  });
}

// The upstream section moved to a later start, a material time change.
function movedCatalog(): NormalizedCatalog {
  const section = makeSection({
    teachTableId: 't1',
    subjectId: '90000001',
    section: '901',
    meetings: [makeMeeting({ startMin: 600, endMin: 780 })],
  });
  return {
    courses: [makeCourse({ subjectId: '90000001', sections: [section] })],
    duplicateCount: 0,
    multiMeetingCount: 0,
    warnings: [],
  };
}

// The triggers only ever send teachTable/query, so a single shape fake is enough; the
// cast is confined to this test seam.
function fakeSend(result: Result<NormalizedCatalog>): TypedSend {
  return (() => Promise.resolve(result)) as unknown as TypedSend;
}

function openPanel(): void {
  act(() => {
    uiStore.setState({ isOpen: true, viewMode: 'edit' });
  });
}

afterEach(() => {
  cleanup();
  resetPlanStore();
  revalidationStore.setState({
    runs: {},
    updatesOpen: false,
    pendingOpen: null,
  });
  uiStore.setState({ isOpen: false, viewMode: 'edit' });
});

describe('useRevalidationTriggers', () => {
  it('asks for the updates dialog when the run on open finds a new change', async () => {
    seedActivePlan([placed()], { id: 'p1' });
    renderHook(() => {
      useRevalidationTriggers(fakeSend(ok(movedCatalog())));
    });
    openPanel();
    await waitFor(() => {
      expect(revalidationStore.getState().pendingOpen).toBe('p1');
    });
    expect(planStore.getState().entries[0]?.review?.notifiedAt).toBeNull();
  });

  it('runs the check after a first add but keeps the dialog closed for it', async () => {
    const section = makeSection({
      teachTableId: 't1',
      subjectId: '90000001',
      section: '901',
    });
    act(() => {
      uiStore.setState({ isOpen: true, viewMode: 'edit' });
    });
    renderHook(() => {
      useRevalidationTriggers(fakeSend(ok(movedCatalog())));
    });
    act(() => {
      planStore
        .getState()
        .add(
          makeCourse({ subjectId: '90000001', sections: [section] }),
          section,
          sourceQuery(),
        );
    });
    const planId = planStore.getState().activePlanId ?? '';
    await waitFor(() => {
      expect(revalidationStore.getState().runs[planId]?.status).toBe('done');
    });
    expect(planStore.getState().entries[0]?.review).toBeDefined();
    expect(planStore.getState().quietPlanId).toBeNull();
    expect(revalidationStore.getState().pendingOpen).toBeNull();
  });

  it('never asks after an offline run', async () => {
    seedActivePlan([placed()], { id: 'p1' });
    renderHook(() => {
      useRevalidationTriggers(fakeSend(err(networkError('down'))));
    });
    openPanel();
    await waitFor(() => {
      expect(revalidationStore.getState().runs.p1?.status).toBe('offline');
    });
    expect(revalidationStore.getState().pendingOpen).toBeNull();
  });

  it('does not ask again on a reopened panel once the item was shown', async () => {
    const before = placed().snapshot;
    seedActivePlan(
      [
        placed({
          kinds: ['time_changed'],
          before,
          detectedAt: '2026-11-06T00:00:00.000Z',
          notifiedAt: '2026-11-06T01:00:00.000Z',
        }),
      ],
      { id: 'p1' },
    );
    renderHook(() => {
      useRevalidationTriggers(fakeSend(ok(movedCatalog())));
    });
    openPanel();
    await waitFor(() => {
      expect(revalidationStore.getState().runs.p1?.status).toBe('done');
    });
    expect(revalidationStore.getState().pendingOpen).toBeNull();
  });
});
