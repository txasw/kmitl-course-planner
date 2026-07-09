// The revalidation driver. It replays each distinct source query a plan's entries
// came from through the gateway, reconciles the entries whose replay succeeded, and
// writes them back. Entries whose query failed keep their status so viewing is never
// blocked and a retry can pick them up; when every replay fails the run is offline.
// Matching, diffing, and reconciling are the pure lib functions; this module only
// fetches, orchestrates, and writes.

import type { NormalizedCatalog } from '@/lib/domain/normalize';
import type { Plan } from '@/lib/domain/plan';
import { sourceQueryToQuery } from '@/lib/planner/sourceQuery';
import { buildSectionIndex, reconcilePlan } from '@/lib/planner/revalidate';
import type { TypedSend } from '@/lib/messaging/sendTyped';
import { planStore } from './planStore';
import {
  revalidationStore,
  type RevalidationStatus,
} from './revalidationStore';

/** Revalidate at most once per plan per this window, except a manual refresh. */
const THROTTLE_MS = 10 * 60 * 1000;

/** A stable key for a source query, so entries from the same search group together. */
function sourceQueryKey(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key] ?? ''}`)
    .join('&');
}

/** Whether an automatic revalidation should run: never for an empty plan, always when
 * an entry has never been verified, otherwise once the oldest check is past the
 * throttle window. */
export function shouldRevalidate(plan: Plan, nowMs: number): boolean {
  if (plan.entries.length === 0) {
    return false;
  }
  let oldest = Infinity;
  for (const entry of plan.entries) {
    if (entry.lastVerifiedAt === null) {
      return true;
    }
    const verifiedAt = Date.parse(entry.lastVerifiedAt);
    if (!Number.isNaN(verifiedAt)) {
      oldest = Math.min(oldest, verifiedAt);
    }
  }
  return nowMs - oldest > THROTTLE_MS;
}

export interface RevalidateDeps {
  send: TypedSend;
  now: () => string;
}

/**
 * Run a revalidation for a plan. A manual run bypasses the cache; an automatic run
 * uses the normal cache and retry rules. The result is reported through the
 * revalidation store for the banner.
 */
export async function revalidatePlanNow(
  plan: Plan,
  deps: RevalidateDeps,
  manual: boolean,
): Promise<void> {
  revalidationStore
    .getState()
    .setRun(plan.id, { status: 'running', report: null });

  const groups = new Map<string, Record<string, string>>();
  for (const entry of plan.entries) {
    const key = sourceQueryKey(entry.sourceQuery.params);
    if (!groups.has(key)) {
      groups.set(key, entry.sourceQuery.params);
    }
  }

  const catalogs: NormalizedCatalog[] = [];
  const succeeded = new Set<string>();
  let anyFailure = false;
  for (const [key, params] of groups) {
    const query = sourceQueryToQuery(params);
    if (query === null) {
      anyFailure = true;
      continue;
    }
    const result = await deps.send({
      type: 'teachTable/query',
      query,
      refresh: manual,
    });
    if (result.ok) {
      catalogs.push(result.value);
      succeeded.add(key);
    } else {
      anyFailure = true;
    }
  }

  const checkedEntries = plan.entries.filter((entry) =>
    succeeded.has(sourceQueryKey(entry.sourceQuery.params)),
  );
  if (checkedEntries.length === 0) {
    // Every replay failed: render from snapshots with the unverified state and a retry.
    revalidationStore
      .getState()
      .setRun(plan.id, { status: 'offline', report: null });
    return;
  }

  const index = buildSectionIndex(catalogs);
  const { plan: reconciled, report } = reconcilePlan(
    { ...plan, entries: checkedEntries },
    index,
    deps.now(),
  );
  planStore.getState().applyRevalidation(plan.id, reconciled.entries);
  const status: RevalidationStatus = anyFailure ? 'partial' : 'done';
  revalidationStore.getState().setRun(plan.id, { status, report });
}
