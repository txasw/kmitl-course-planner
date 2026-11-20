// The plan's own subjects in a suggestion search (ADR-0054, amended 2026-11-21): a
// ticked plan subject is in every timetable at its own section or another open one,
// a move is offered only where it gains room for a course or a lower penalty, and an
// unticked one is left out.

import { describe, it, expect } from 'vitest';
import {
  makeMeeting,
  makePlanEntry,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import { curriculumCourse, lockSections } from '../../../tests/support/suggest';
import { suggestPlans, type Suggestion } from './suggest';
import { changesPlan } from './suggestEmpty';

const at = (day: 1 | 2 | 3 | 4 | 5, startMin = 540) => [
  makeMeeting({ day, startMin, endMin: startMin + 180 }),
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

  it('never offers a move that gains nothing', () => {
    // Tuesday instead of Monday is the same two day week, so it only reshuffles.
    const wednesday = curriculumCourse('33333333', [{ meetings: at(3) }]);
    const { suggestions } = suggestPlans({
      courses: [held, wednesday],
      entries,
      objective: 'coverAll',
      preference: 'balanced',
    });
    expect(suggestions.map(sectionsOf)).toEqual([
      [
        ['11111111', '1', true],
        ['33333333', '1', false],
      ],
    ]);
  });

  it('offers a move that lowers the penalty, ranked first', () => {
    // A Tuesday afternoon course: moving to Tuesday morning makes a one day week.
    const tuesday = curriculumCourse('33333333', [{ meetings: at(2, 780) }]);
    const { suggestions } = suggestPlans({
      courses: [held, tuesday],
      entries,
      objective: 'coverAll',
      preference: 'fewerDays',
    });
    expect(suggestions.map(sectionsOf)).toEqual([
      [
        ['11111111', '2', false],
        ['33333333', '1', false],
      ],
      [
        ['11111111', '1', true],
        ['33333333', '1', false],
      ],
    ]);
  });

  it('keeps the needed move but not a second one that gains nothing', () => {
    const other = curriculumCourse('44444444', [
      { meetings: at(3) },
      { meetings: at(4) },
    ]);
    const mondayOnly = curriculumCourse('22222222', [{ meetings: at(1) }]);
    const { suggestions } = suggestPlans({
      courses: [held, other, mondayOnly],
      entries: lockSections(
        [held, other],
        [
          ['11111111', '1'],
          ['44444444', '1'],
        ],
      ),
      objective: 'coverAll',
      preference: 'balanced',
    });
    expect(suggestions.map(sectionsOf)).toEqual([
      [
        ['11111111', '2', false],
        ['22222222', '1', false],
        ['44444444', '1', true],
      ],
      [
        ['11111111', '1', true],
        ['44444444', '1', true],
      ],
    ]);
  });

  it('names a plan subject as the clash only where the timetable keeps its section', () => {
    const mondayOnly = curriculumCourse('22222222', [{ meetings: at(1) }]);
    const tuesdayOnly = curriculumCourse('33333333', [{ meetings: at(2) }]);
    const { suggestions } = suggestPlans({
      courses: [held, mondayOnly, tuesdayOnly],
      entries,
      objective: 'coverAll',
      preference: 'balanced',
    });
    const reasons = suggestions.map((suggestion) =>
      suggestion.leftOut.map(({ course, reason }) => [
        course.subjectId,
        reason.kind,
      ]),
    );
    // Kept on Monday, the plan's 11111111 is what the Monday course meets; moved to
    // Tuesday, it is no longer the plan's section, so the Tuesday course just does
    // not fit beside it.
    expect(reasons).toEqual([
      [['22222222', 'locked']],
      [['33333333', 'noFit']],
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

  it('offers only the plan as it is when nothing is added and no move gains', () => {
    const { suggestions } = suggestPlans({
      courses: [held],
      entries,
      objective: 'coverAll',
      preference: 'balanced',
    });
    expect(suggestions.map(changesPlan)).toEqual([false]);
  });
});
