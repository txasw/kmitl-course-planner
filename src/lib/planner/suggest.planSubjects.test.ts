// The plan's own subjects in a suggestion search (ADR-0054, amended 2026-11-21): a
// ticked plan subject is in every timetable at its own section or another open one,
// a move is offered only where it gains something, and an unticked one is left out.

import { describe, it, expect } from 'vitest';
import {
  makeMeeting,
  makePlanEntry,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import { curriculumCourse, lockSections } from '../../../tests/support/suggest';
import { suggestPlans, type Suggestion } from './suggest';
import { changesPlan } from './suggestEmpty';

const at = (day: 1 | 2 | 3 | 4 | 5) => [
  makeMeeting({ day, startMin: 540, endMin: 720 }),
];

function sectionsOf(suggestion: Suggestion | undefined) {
  return (suggestion?.choices ?? []).map((c) => [
    c.course.subjectId,
    c.section.section,
    c.current,
  ]);
}

describe('suggestPlans with subjects already in the plan', () => {
  // A student placed 11111111 on Monday by hand; its other open section is Tuesday.
  const held = curriculumCourse('11111111', [
    { meetings: at(1) },
    { meetings: at(2) },
  ]);
  const entries = lockSections([held], [['11111111', '1']]);

  it('moves a plan subject to another open section to fit a ticked course', () => {
    const mondayOnly = curriculumCourse('22222222', [{ meetings: at(1) }]);
    const [best] = suggestPlans({
      courses: [held, mondayOnly],
      entries,
      objective: 'coverAll',
      preference: 'balanced',
    }).suggestions;
    expect(sectionsOf(best)).toEqual([
      ['11111111', '2', false],
      ['22222222', '1', false],
    ]);
    expect(best?.leftOut).toEqual([]);
  });

  it('keeps a plan subject at its own section when a move gains nothing', () => {
    const wednesday = curriculumCourse('33333333', [{ meetings: at(3) }]);
    const { suggestions } = suggestPlans({
      courses: [held, wednesday],
      entries,
      objective: 'coverAll',
      preference: 'balanced',
    });
    expect(sectionsOf(suggestions[0])).toEqual([
      ['11111111', '1', true],
      ['33333333', '1', false],
    ]);
    // The move is still offered, ranked after, as a different week.
    expect(sectionsOf(suggestions[1])).toEqual([
      ['11111111', '2', false],
      ['33333333', '1', false],
    ]);
  });

  it('leaves an unticked plan subject out of every timetable', () => {
    const mondayOnly = curriculumCourse('22222222', [{ meetings: at(1) }]);
    const { suggestions } = suggestPlans({
      courses: [held, mondayOnly],
      subjects: new Set(['22222222']),
      entries,
      objective: 'coverAll',
      preference: 'balanced',
    });
    for (const suggestion of suggestions) {
      expect(suggestion.choices.map((c) => c.course.subjectId)).toEqual([
        '22222222',
      ]);
      expect(suggestion.leftOut).toEqual([]);
      expect(suggestion.stats).toMatchObject({ courses: 1, credits: 3 });
    }
  });

  it('holds a hand added subject the result lacks at its own section', () => {
    const gened = makePlanEntry({
      snapshot: makeSnapshot({
        subjectId: '90000009',
        teachTableId: 'g1',
        section: '7',
        meetings: at(1),
      }),
    });
    const mondayOrTuesday = curriculumCourse('22222222', [
      { meetings: at(1) },
      { meetings: at(2) },
    ]);
    const [best] = suggestPlans({
      courses: [mondayOrTuesday],
      entries: [gened],
      objective: 'coverAll',
      preference: 'balanced',
    }).suggestions;
    expect(sectionsOf(best)).toEqual([
      ['22222222', '2', false],
      ['90000009', '7', true],
    ]);
    expect(best?.stats).toMatchObject({ courses: 2, credits: 6 });
  });

  it('returns nothing when the ticked plan subjects cannot all fit together', () => {
    const clash = (subjectId: string, teachTableId: string) =>
      makePlanEntry({
        snapshot: makeSnapshot({ subjectId, teachTableId, meetings: at(4) }),
      });
    const { suggestions } = suggestPlans({
      courses: [],
      entries: [clash('44444444', 'c1'), clash('55555555', 'c2')],
      objective: 'coverAll',
      preference: 'balanced',
    });
    expect(suggestions).toEqual([]);
  });

  it('marks a timetable that keeps the plan as it is as no change', () => {
    const { suggestions } = suggestPlans({
      courses: [held],
      entries,
      objective: 'coverAll',
      preference: 'balanced',
    });
    expect(suggestions.map(changesPlan)).toEqual([false, true]);
  });
});
