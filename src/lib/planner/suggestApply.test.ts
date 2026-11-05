import { describe, it, expect } from 'vitest';
import {
  SUGGEST_NOW,
  SUGGEST_QUERY,
  SUGGEST_TERM,
  byClassCourses,
  lockSections,
} from '../../../tests/support/suggest';
import type { PlanEntry } from '../domain/plan';
import { suggestPlans, type Suggestion } from './suggest';
import { applySuggestion } from './suggestApply';

const courses = byClassCourses();

function bestSuggestion(locked: PlanEntry[]): Suggestion {
  const [best] = suggestPlans({
    courses,
    locked,
    objective: 'coverAll',
    preference: 'balanced',
  }).suggestions;
  if (best === undefined) {
    throw new Error('no suggestion');
  }
  return best;
}

describe('applySuggestion', () => {
  it('adds every chosen group after the locked entries through the add gate', () => {
    const locked = lockSections(courses, [['04186098', '2']]);
    const best = bestSuggestion(locked);
    const outcome = applySuggestion(
      locked,
      best,
      SUGGEST_QUERY,
      SUGGEST_NOW,
      SUGGEST_TERM,
    );
    if (!outcome.ok) {
      throw new Error('apply was refused');
    }
    const groupIds = best.choices.flatMap((c) =>
      c.group.map((s) => s.teachTableId),
    );
    expect(outcome.result.entries.slice(0, locked.length)).toEqual(locked);
    expect(outcome.result.added.map((e) => e.teachTableId)).toEqual(groupIds);
    expect(
      outcome.result.added.every((e) => e.sourceQuery === SUGGEST_QUERY),
    ).toBe(true);
    expect(outcome.result.removed).toEqual([]);
    expect(locked).toHaveLength(1);
  });

  it('returns the refusal when the add gate rejects a choice', () => {
    const outcome = applySuggestion(
      [],
      bestSuggestion([]),
      SUGGEST_QUERY,
      SUGGEST_NOW,
      { year: '2569', semester: '2' },
    );
    expect(outcome).toMatchObject({ ok: false, crossTerm: {} });
  });

  it('refuses a suggestion that no longer fits the entries it is applied to', () => {
    const best = bestSuggestion([]);
    const clash = lockSections(courses, [['04186098', '2']]);
    const outcome = applySuggestion(
      clash,
      best,
      SUGGEST_QUERY,
      SUGGEST_NOW,
      SUGGEST_TERM,
    );
    expect(!outcome.ok && 'conflicts' in outcome).toBe(true);
  });
});
