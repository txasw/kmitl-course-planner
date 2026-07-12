import { describe, it, expect, afterEach } from 'vitest';
import { ok, err, networkError, type Result } from '@/lib/utils/result';
import type { NormalizedCatalog } from '@/lib/domain/normalize';
import type { Plan, SourceQuery } from '@/lib/domain/plan';
import type { TypedSend } from '@/lib/messaging/sendTyped';
import {
  makeCourse,
  makeMeeting,
  makePlan,
  makePlanEntry,
  makeSection,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import { planStore } from './planStore';
import { revalidationStore } from './revalidationStore';
import { revalidatePlanNow, shouldRevalidate } from './revalidationController';

const NOW = '2026-07-09T00:00:00.000Z';

function fullSourceQuery(subjectId: string): SourceQuery {
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
      selected_subject_id: subjectId,
    },
  };
}

function catalogOf(
  ...sections: ReturnType<typeof makeSection>[]
): NormalizedCatalog {
  return {
    courses: sections.map((section) =>
      makeCourse({ subjectId: section.subjectId, sections: [section] }),
    ),
    duplicateCount: 0,
    multiMeetingCount: 0,
    warnings: [],
  };
}

// The controller only ever sends teachTable/query, so a single-shape fake is enough;
// the cast is confined to this test seam.
function fakeSend(
  handler: () => Promise<Result<NormalizedCatalog>>,
): TypedSend {
  return handler as unknown as TypedSend;
}

const deps = { now: () => NOW };

afterEach(() => {
  planStore.setState({
    plans: [],
    activePlanId: null,
    entries: [],
    pendingUndo: null,
  });
  revalidationStore.setState({ runs: {} });
});

function seed(plan: Plan): void {
  planStore.setState({
    plans: [plan],
    activePlanId: plan.id,
    entries: plan.entries,
    pendingUndo: null,
  });
}

describe('revalidatePlanNow', () => {
  it('reconciles a changed entry and reports done', async () => {
    const entry = makePlanEntry({
      snapshot: makeSnapshot({
        teachTableId: 't1',
        subjectId: 'S1',
        section: '901',
      }),
      sourceQuery: fullSourceQuery('S1'),
    });
    const plan = makePlan({ id: 'p1', entries: [entry] });
    seed(plan);
    const fresh = makeSection({
      teachTableId: 't1',
      subjectId: 'S1',
      section: '901',
      meetings: [makeMeeting({ startMin: 600, endMin: 780 })],
    });
    const send = fakeSend(() => Promise.resolve(ok(catalogOf(fresh))));

    await revalidatePlanNow(plan, { send, ...deps }, false);

    const updated = planStore.getState().plans[0]?.entries[0];
    expect(updated?.verifyStatus).toBe('changed');
    expect(updated?.snapshot.meetings[0]?.startMin).toBe(600);
    expect(revalidationStore.getState().runs.p1?.status).toBe('done');
  });

  it('reports offline and changes nothing when every replay fails', async () => {
    const entry = makePlanEntry({
      snapshot: makeSnapshot({
        teachTableId: 't1',
        subjectId: 'S1',
        section: '901',
      }),
      sourceQuery: fullSourceQuery('S1'),
    });
    const plan = makePlan({ id: 'p1', entries: [entry] });
    seed(plan);
    const send = fakeSend(() => Promise.resolve(err(networkError('down'))));

    await revalidatePlanNow(plan, { send, ...deps }, false);

    expect(planStore.getState().plans[0]?.entries[0]?.verifyStatus).toBe(
      'unverified',
    );
    expect(revalidationStore.getState().runs.p1?.status).toBe('offline');
  });

  it('reconciles the succeeded entries and reports partial on a mixed result', async () => {
    const a = makePlanEntry({
      snapshot: makeSnapshot({
        teachTableId: 'a',
        subjectId: 'S1',
        section: '901',
      }),
      sourceQuery: fullSourceQuery('S1'),
    });
    const b = makePlanEntry({
      snapshot: makeSnapshot({
        teachTableId: 'b',
        subjectId: 'S2',
        section: '902',
      }),
      sourceQuery: fullSourceQuery('S2'),
    });
    const plan = makePlan({ id: 'p1', entries: [a, b] });
    seed(plan);
    const freshA = makeSection({
      teachTableId: 'a',
      subjectId: 'S1',
      section: '901',
    });
    let call = 0;
    const send = fakeSend(() => {
      call += 1;
      return call === 1
        ? Promise.resolve(ok(catalogOf(freshA)))
        : Promise.resolve(err(networkError('down')));
    });

    await revalidatePlanNow(plan, { send, ...deps }, false);

    const entries = planStore.getState().plans[0]?.entries;
    expect(entries?.find((e) => e.subjectId === 'S1')?.verifyStatus).toBe(
      'verified',
    );
    // The failed group's entry keeps its status and is retried later.
    expect(entries?.find((e) => e.subjectId === 'S2')?.verifyStatus).toBe(
      'unverified',
    );
    expect(revalidationStore.getState().runs.p1?.status).toBe('partial');
  });
});

describe('shouldRevalidate', () => {
  const nowMs = Date.parse(NOW);

  it('does not revalidate an empty plan', () => {
    expect(shouldRevalidate(makePlan({ entries: [] }), nowMs)).toBe(false);
  });

  it('revalidates when an entry was never verified', () => {
    const plan = makePlan({
      entries: [makePlanEntry({ lastVerifiedAt: null })],
    });
    expect(shouldRevalidate(plan, nowMs)).toBe(true);
  });

  it('throttles a recently verified plan', () => {
    const recent = new Date(nowMs - 60_000).toISOString();
    const plan = makePlan({
      entries: [makePlanEntry({ lastVerifiedAt: recent })],
    });
    expect(shouldRevalidate(plan, nowMs)).toBe(false);
  });

  it('revalidates when the oldest check is past the window', () => {
    const old = new Date(nowMs - 11 * 60_000).toISOString();
    const plan = makePlan({
      entries: [makePlanEntry({ lastVerifiedAt: old })],
    });
    expect(shouldRevalidate(plan, nowMs)).toBe(true);
  });
});
