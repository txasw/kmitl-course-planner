// Helpers for the updates dialog notice tests: an entry holding an open review, and a
// read of whether the active plan's entry was marked shown.

import type { PlanEntry } from '../../src/lib/domain/plan';
import { planStore } from '../../src/features/plans/planStore';
import { makePlanEntry, makeSnapshot } from './domain-builders';

/** An entry with an open time change review, not yet shown unless notifiedAt is given. */
export function reviewedEntry(
  id: string,
  notifiedAt: string | null = null,
): PlanEntry {
  const snapshot = makeSnapshot({
    teachTableId: id,
    subjectId: `9000000${id}`,
  });
  return makePlanEntry({
    snapshot,
    verifyStatus: 'changed',
    review: {
      kinds: ['time_changed'],
      before: snapshot,
      detectedAt: '2026-11-06T00:00:00.000Z',
      notifiedAt,
    },
  });
}

/** The notifiedAt of an active plan entry's review, undefined when it holds none. */
export function notifiedAtOf(id: string): string | null | undefined {
  return planStore.getState().entries.find((entry) => entry.teachTableId === id)
    ?.review?.notifiedAt;
}
