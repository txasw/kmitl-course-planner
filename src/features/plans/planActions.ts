// Pure helpers over the list of saved plans. Keeping the plan construction, the
// default naming, the latest selection, and the entry replacement here leaves the
// store a thin set of transactions and lets these rules be tested without a store.

import type { Plan, PlanEntry } from '@/lib/domain/plan';
import type { Term } from '@/lib/routing/academicTerms';

/** A fresh, empty plan for a term. */
export function makePlan(
  id: string,
  name: string,
  term: Term,
  now: string,
): Plan {
  return {
    id,
    name,
    year: term.year,
    semester: term.semester,
    entries: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** The default name for a new plan of a term: the Thai schedule label with the term. */
export function defaultPlanName(term: Term): string {
  return `ตาราง ${term.semester}/${term.year}`;
}

/**
 * The plan most recently updated, or null when there are none. ISO timestamps sort
 * lexically in chronological order, so a plain string compare picks the latest.
 */
export function mostRecentlyUpdated(plans: Plan[]): Plan | null {
  let latest: Plan | null = null;
  for (const plan of plans) {
    if (latest === null || plan.updatedAt > latest.updatedAt) {
      latest = plan;
    }
  }
  return latest;
}

/** Replace one plan's entries and stamp its updatedAt, leaving the other plans as is. */
export function replaceEntries(
  plans: Plan[],
  planId: string,
  entries: PlanEntry[],
  now: string,
): Plan[] {
  return plans.map((plan) =>
    plan.id === planId ? { ...plan, entries, updatedAt: now } : plan,
  );
}

/**
 * A duplicate of a plan under a new id and name with fresh timestamps and copied
 * entries, so editing the copy never mutates the original.
 */
export function duplicatePlanOf(
  plan: Plan,
  id: string,
  name: string,
  now: string,
): Plan {
  return {
    ...plan,
    id,
    name,
    createdAt: now,
    updatedAt: now,
    entries: plan.entries.map((entry) => ({ ...entry })),
  };
}

function identity(entry: PlanEntry): string {
  return `${entry.subjectId}|${entry.section}`;
}

/**
 * Fold reconciled entries back into the current entries by durable identity, so a
 * revalidation applies only to entries still present. An entry the user removed during
 * the round trip is not in the current list and is dropped; one they added is not in
 * the reconciled set and is kept as is.
 */
export function mergeReconciled(
  entries: PlanEntry[],
  reconciled: PlanEntry[],
): PlanEntry[] {
  const byIdentity = new Map(
    reconciled.map((entry) => [identity(entry), entry]),
  );
  return entries.map((entry) => byIdentity.get(identity(entry)) ?? entry);
}

/** Mark a changed entry as verified once its change has been acknowledged. */
export function acknowledgeEntry(
  entries: PlanEntry[],
  teachTableId: string,
): PlanEntry[] {
  return entries.map((entry) =>
    entry.teachTableId === teachTableId && entry.verifyStatus === 'changed'
      ? { ...entry, verifyStatus: 'verified' }
      : entry,
  );
}
