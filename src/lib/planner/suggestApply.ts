// Apply a plan suggestion. The entries are built through applyPlanTransaction, one
// chosen course at a time on top of the given entries, so a suggestion can never
// place what the add gate would refuse: the term check, the placement check, and
// pair expansion all run exactly as they do for a hand add. The caller decides
// where the entries go; the suggestion flow puts them in a new plan and leaves the
// plan it started from untouched.

import type { PlanEntry, SourceQuery } from '../domain/plan';
import type { Term } from '../routing/academicTerms';
import type { Suggestion } from './suggest';
import { applyPlanTransaction, type TransactionOutcome } from './transaction';

/**
 * The given entries followed by every chosen section group of the suggestion. On
 * the first refusal the refusal is returned and no entries are.
 */
export function applySuggestion(
  entries: PlanEntry[],
  suggestion: Suggestion,
  sourceQuery: SourceQuery,
  now: string,
  planTerm: Term,
): TransactionOutcome {
  let working = entries;
  const added: PlanEntry[] = [];
  for (const choice of suggestion.choices) {
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
  return { ok: true, result: { entries: working, added, removed: [] } };
}
