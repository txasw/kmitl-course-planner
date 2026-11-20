import { describe, it, expect } from 'vitest';
import { makeMeeting } from '../../../tests/support/domain-builders';
import {
  SUGGEST_NOW,
  SUGGEST_QUERY,
  SUGGEST_TERM,
  byClassCourses,
  curriculumCourse,
  lockSections,
} from '../../../tests/support/suggest';
import type { Course } from '../domain/types';
import type { PlanEntry } from '../domain/plan';
import { suggestPlans, type Suggestion } from './suggest';
import { applySuggestion } from './suggestApply';

const courses = byClassCourses();

function bestSuggestion(
  entries: PlanEntry[],
  from: Course[] = courses,
  subjects?: Set<string>,
): Suggestion {
  const [best] = suggestPlans({
    courses: from,
    entries,
    ...(subjects === undefined ? {} : { subjects }),
    objective: 'coverAll',
    preference: 'balanced',
  }).suggestions;
  if (best === undefined) {
    throw new Error('no suggestion');
  }
  return best;
}

function apply(entries: PlanEntry[], suggestion: Suggestion) {
  const outcome = applySuggestion(
    entries,
    suggestion,
    SUGGEST_QUERY,
    SUGGEST_NOW,
    SUGGEST_TERM,
  );
  if (!outcome.ok) {
    throw new Error('apply was refused');
  }
  return outcome.result;
}

const monday = [makeMeeting({ day: 1, startMin: 540, endMin: 720 })];
const tuesday = [makeMeeting({ day: 2, startMin: 540, endMin: 720 })];

describe('applySuggestion', () => {
  it('keeps the plan entries held at their own group and adds the rest through the add gate', () => {
    const held = curriculumCourse('11111111', [{ meetings: monday }]);
    const other = curriculumCourse('22222222', [{ meetings: tuesday }]);
    const entries = lockSections([held], [['11111111', '1']]);
    const result = apply(entries, bestSuggestion(entries, [held, other]));
    expect(result.entries[0]).toBe(entries[0]);
    expect(result.added.map((e) => [e.subjectId, e.section])).toEqual([
      ['22222222', '1'],
    ]);
    expect(result.added.every((e) => e.sourceQuery === SUGGEST_QUERY)).toBe(
      true,
    );
    expect(result.removed).toEqual([]);
  });

  it('applies the best suggestion on the by_class capture through the add gate', () => {
    const entries = lockSections(courses, [['04186098', '2']]);
    const best = bestSuggestion(entries);
    const result = apply(entries, best);
    expect(result.entries.map((e) => e.teachTableId).sort()).toEqual(
      best.choices.flatMap((c) => c.group.map((m) => m.teachTableId)).sort(),
    );
  });

  it('moves a plan subject to the section the suggestion chose', () => {
    const held = curriculumCourse('11111111', [
      { meetings: monday },
      { meetings: tuesday },
    ]);
    const only = curriculumCourse('22222222', [{ meetings: monday }]);
    const entries = lockSections([held], [['11111111', '1']]);
    const result = apply(entries, bestSuggestion(entries, [held, only]));
    expect(result.removed).toEqual(entries);
    expect(result.entries.map((e) => [e.subjectId, e.section])).toEqual([
      ['11111111', '2'],
      ['22222222', '1'],
    ]);
  });

  it('drops a plan subject the student unticked', () => {
    const held = curriculumCourse('11111111', [{ meetings: monday }]);
    const other = curriculumCourse('22222222', [{ meetings: tuesday }]);
    const entries = lockSections([held], [['11111111', '1']]);
    const best = bestSuggestion(entries, [held, other], new Set(['22222222']));
    const result = apply(entries, best);
    expect(result.entries.map((e) => e.subjectId)).toEqual(['22222222']);
    expect(result.removed).toEqual(entries);
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

  it('refuses a suggestion searched against other entries as stale', () => {
    const best = bestSuggestion([]);
    const changed = lockSections(courses, [['04186098', '2']]);
    const outcome = applySuggestion(
      changed,
      best,
      SUGGEST_QUERY,
      SUGGEST_NOW,
      SUGGEST_TERM,
    );
    expect(outcome).toEqual({ ok: false, stale: true });
  });
});
