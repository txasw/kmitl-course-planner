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
 * A plan built from an imported blob. It takes a fresh id and timestamps so it never
 * overwrites an existing plan, and every entry is reset to unverified so the standard
 * revalidation on first open reconciles the imported snapshots against live data.
 * Entries that share a durable identity are collapsed to the first, since import
 * bypasses the add path's duplicate guard and a duplicate identity would corrupt the
 * reconcile fold. The plan is already term consistent because the schema validated it.
 */
export function importedPlan(
  plan: Plan,
  id: string,
  name: string,
  now: string,
): Plan {
  const seen = new Set<string>();
  const entries: PlanEntry[] = [];
  for (const entry of plan.entries) {
    const key = identity(entry);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    entries.push({
      ...entry,
      verifyStatus: 'unverified',
      lastVerifiedAt: null,
    });
  }
  return { ...plan, id, name, createdAt: now, updatedAt: now, entries };
}

/**
 * A plan name that does not collide with an existing plan, suffixing a counter when
 * it would, so an import never silently overwrites or shadows a plan of the same name.
 */
export function uniquePlanName(name: string, plans: Plan[]): string {
  const existing = new Set(plans.map((plan) => plan.name));
  if (!existing.has(name)) {
    return name;
  }
  let counter = 2;
  while (existing.has(`${name} (${String(counter)})`)) {
    counter += 1;
  }
  return `${name} (${String(counter)})`;
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
