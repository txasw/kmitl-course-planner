// Apply a plan suggestion. The plan's entries the suggestion keeps at their own
// section group stay as they are; a plan subject it moves or leaves out, because
// the student unticked it, drops out. Every other chosen group is then built
// through applyPlanTransaction, one course at a time on top of the kept entries,
// so a suggestion can never place what the add gate would refuse: the term check,
// the placement check, and pair expansion all run exactly as they do for a hand
// add. A suggestion searched against other entries is refused as stale rather than
// applied, since it could drop a subject the student added after the search. The
// caller decides where the entries go; the suggestion flow puts them in a new plan
// and leaves the plan it started from untouched.

import type { PlanEntry, SourceQuery } from '../domain/plan';
import type { Term } from '../routing/academicTerms';
import type { Suggestion } from './suggest';
import { applyPlanTransaction, type TransactionOutcome } from './transaction';

export type SuggestApplyOutcome =
  TransactionOutcome | { ok: false; stale: true };

function entryKey(ids: readonly string[]): string {
  return [...ids].sort().join(',');
}

/**
 * The kept entries followed by every other chosen section group of the suggestion.
 * On the first refusal the refusal is returned and no entries are.
 */
export function applySuggestion(
  entries: PlanEntry[],
  suggestion: Suggestion,
  sourceQuery: SourceQuery,
  now: string,
  planTerm: Term,
): SuggestApplyOutcome {
  if (
    entryKey(entries.map((entry) => entry.teachTableId)) !==
    entryKey(suggestion.planIds)
  ) {
    return { ok: false, stale: true };
  }
  const keptIds = new Set(
    suggestion.choices
      .filter((choice) => choice.current)
      .flatMap((choice) => choice.group.map((member) => member.teachTableId)),
  );
  let working = entries.filter((entry) => keptIds.has(entry.teachTableId));
  const added: PlanEntry[] = [];
  for (const choice of suggestion.choices) {
    if (choice.current) {
      continue;
    }
    const outcome = applyPlanTransaction(
      working,
      [],
      { course: choice.course, section: choice.section, sourceQuery },
      now,
      planTerm,
    );
    if (!outcome.ok) {
      return outcome;
    }
    working = outcome.result.entries;
    added.push(...outcome.result.added);
  }
  return {
    ok: true,
    result: {
      entries: working,
      added,
      removed: entries.filter((entry) => !keptIds.has(entry.teachTableId)),
    },
  };
}
