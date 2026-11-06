// A whole plan revalidation that classifies every entry without reconciling it.

import type { Plan } from '../domain/plan';
import {
  revalidateEntry,
  type EntryRevalidation,
  type SectionIndex,
} from './revalidateDiff';
import { summarize, type RevalidationSummary } from './reconcile';

export interface PlanRevalidation {
  entries: EntryRevalidation[];
  summary: RevalidationSummary;
}

/** Revalidate every entry in a plan against the fresh index and summarize. */
export function revalidatePlan(
  plan: Plan,
  index: SectionIndex,
): PlanRevalidation {
  const entries = plan.entries.map((entry) => revalidateEntry(entry, index));
  return { entries, summary: summarize(entries) };
}
