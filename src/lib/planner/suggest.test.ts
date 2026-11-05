import { describe, it, expect } from 'vitest';
import {
  makeCourse,
  makeMeeting,
  makeSection,
} from '../../../tests/support/domain-builders';
import {
  SUGGEST_NOW,
  SUGGEST_QUERY,
  SUGGEST_TERM,
  byClassCourses,
  curriculumCourse,
  lockSections,
} from '../../../tests/support/suggest';
import { computeSeatStatus } from '../catalog/seatStatus';
import { isCurriculumCourse } from '../catalog/subjectGroup';
import type { Course, Section } from '../domain/types';
import type { PlanEntry } from '../domain/plan';
import { checkPlacement, expandSectionGroup } from './placement';
import type { SuggestObjective } from './suggestRank';
import { preferencePenalty, type SuggestPreference } from './suggestScore';
import { addSectionGroup, placedSections } from './transaction';
import { SUGGEST_NODE_CAP, suggestPlans, type Suggestion } from './suggest';

const OBJECTIVES: SuggestObjective[] = ['coverAll', 'maxCredits'];
const PREFERENCES: SuggestPreference[] = [
  'balanced',
  'morning',
  'afternoon',
  'fewerDays',
  'compact',
];
const MIDTERM = { start: '2026-08-17 09:30:00', end: '2026-08-17 12:30:00' };

/** Add the suggestion's groups one at a time, as the add path would. */
function passesAsAWhole(locked: PlanEntry[], suggestion: Suggestion): boolean {
  const placed = placedSections(locked);
  for (const choice of suggestion.choices) {
    if (!checkPlacement(placed, choice.group).ok) {
      return false;
    }
    placed.push(...choice.group);
  }
  return true;
}

function timetableMeetings(locked: PlanEntry[], suggestion: Suggestion) {
  return [
    ...placedSections(locked),
    ...suggestion.choices.flatMap((c) => c.group),
  ].flatMap((s) => s.meetings);
}

interface Feasible {
  courses: number;
  credits: number;
  sections: Section[];
}

/** Every feasible curriculum set, enumerated without the search. */
function bruteForce(courses: Course[], locked: PlanEntry[]): Feasible[] {
  const lockedSubjects = new Set(locked.map((e) => e.subjectId));
  const candidates = courses.filter(
    (c) => isCurriculumCourse(c) && !lockedSubjects.has(c.subjectId),
  );
  const out: Feasible[] = [];
  const walk = (i: number, placed: Section[], picked: Course[]): void => {
    const course = candidates[i];
    if (course === undefined) {
      out.push({
        courses: picked.length,
        credits: picked.reduce((n, c) => n + c.credit, 0),
        sections: placed,
      });
      return;
    }
    walk(i + 1, placed, picked);
    for (const section of course.sections) {
      const group = expandSectionGroup(course, section);
      const open = group.every((s) => computeSeatStatus(s).kind === 'open');
      if (open && checkPlacement(placed, group).ok) {
        walk(i + 1, [...placed, ...group], [...picked, course]);
      }
    }
  };
  walk(0, placedSections(locked), []);
  return out;
}

describe('suggestPlans on the by_class capture', () => {
  const courses = byClassCourses();

  it('returns only feasible timetables of open curriculum sections', () => {
    for (const objective of OBJECTIVES) {
      for (const preference of PREFERENCES) {
        const { suggestions, truncated } = suggestPlans({
          courses,
          locked: [],
          objective,
          preference,
        });
        expect(truncated).toBe(false);
        expect(suggestions).toHaveLength(3);
        for (const suggestion of suggestions) {
          expect(passesAsAWhole([], suggestion)).toBe(true);
          for (const choice of suggestion.choices) {
            expect(isCurriculumCourse(choice.course)).toBe(true);
            for (const member of choice.group) {
              expect(computeSeatStatus(member).kind).toBe('open');
            }
          }
        }
      }
    }
  });

  it('covers the most curriculum courses a brute force finds', () => {
    const feasible = bruteForce(courses, []);
    const most = Math.max(...feasible.map((f) => f.courses));
    const { suggestions } = suggestPlans({
      courses,
      locked: [],
      objective: 'coverAll',
      preference: 'balanced',
    });
    expect(most).toBe(6);
    for (const suggestion of suggestions) {
      expect(suggestion.choices).toHaveLength(most);
    }
  });

  it('never returns fewer credits than a feasible set under maxCredits', () => {
    const feasible = bruteForce(courses, []);
    const most = Math.max(...feasible.map((f) => f.credits));
    const [best] = suggestPlans({
      courses,
      locked: [],
      objective: 'maxCredits',
      preference: 'compact',
    }).suggestions;
    expect(best?.stats.credits).toBe(most);
  });

  it('orders morning and afternoon suggestions by their penalty', () => {
    const feasible = bruteForce(courses, []);
    const most = Math.max(...feasible.map((f) => f.courses));
    for (const preference of ['morning', 'afternoon'] as const) {
      const { suggestions } = suggestPlans({
        courses,
        locked: [],
        objective: 'coverAll',
        preference,
      });
      const penalties = suggestions.map((s) => s.penalty);
      expect(penalties).toEqual([...penalties].sort((a, b) => a - b));
      suggestions.forEach((s) => {
        expect(s.penalty).toBe(
          preferencePenalty(timetableMeetings([], s), preference),
        );
      });
      const least = Math.min(
        ...feasible
          .filter((f) => f.courses === most)
          .map((f) =>
            preferencePenalty(
              f.sections.flatMap((s) => s.meetings),
              preference,
            ),
          ),
      );
      expect(penalties[0]).toBe(least);
    }
  });

  it('fits all six curriculum courses and leaves the GenEd ones alone', () => {
    const [best] = suggestPlans({
      courses,
      locked: [],
      objective: 'coverAll',
      preference: 'balanced',
    }).suggestions;
    expect(best?.choices.map((c) => c.course.subjectId)).toEqual([
      '01006020',
      '01006021',
      '01006030',
      '01006503',
      '01476012',
      '01476101',
    ]);
    expect(best?.leftOut).toEqual([]);
    expect(best?.stats).toMatchObject({ credits: 16, courses: 6 });
  });

  it('keeps locked entries and never clashes with them', () => {
    // The lab is a curriculum course the student placed by hand; the GenEd sits on
    // Tuesday afternoon, the only other slot physics and psychology have.
    const locked = lockSections(courses, [
      ['01006021', '3'],
      ['04186098', '2'],
    ]);
    const { suggestions } = suggestPlans({
      courses,
      locked,
      objective: 'coverAll',
      preference: 'morning',
    });
    expect(suggestions.length).toBeGreaterThan(0);
    for (const suggestion of suggestions) {
      expect(passesAsAWhole(locked, suggestion)).toBe(true);
      const subjects = suggestion.choices.map((c) => c.course.subjectId);
      expect(subjects).not.toContain('01006021');
      expect(subjects).not.toContain('01006020');
      expect(suggestion.stats.courses).toBe(subjects.length + 2);
      expect(
        suggestion.leftOut.map(({ course, reason }) => [
          course.subjectId,
          reason.kind,
          'blocking' in reason
            ? `${reason.blocking.subjectId}/${reason.blocking.section}`
            : null,
        ]),
      ).toEqual([
        ['01006020', 'locked', '01006021/3'],
        ['01006503', 'locked', '04186098/2'],
      ]);
    }
  });

  it('offers only maximal timetables', () => {
    const locked = lockSections(courses, [['04186098', '2']]);
    for (const preference of PREFERENCES) {
      const { suggestions } = suggestPlans({
        courses,
        locked,
        objective: 'coverAll',
        preference,
      });
      for (const suggestion of suggestions) {
        const placed = [
          ...placedSections(locked),
          ...suggestion.choices.flatMap((c) => c.group),
        ];
        for (const { course } of suggestion.leftOut) {
          const fits = course.sections.some(
            (s) =>
              computeSeatStatus(s).kind === 'open' &&
              checkPlacement(placed, expandSectionGroup(course, s)).ok,
          );
          expect(fits).toBe(false);
        }
      }
    }
  });

  it('gives identical results across runs', () => {
    const input = {
      courses,
      locked: lockSections(courses, [['04186098', '2']]),
      objective: 'maxCredits',
      preference: 'balanced',
    } as const;
    expect(suggestPlans(input)).toEqual(suggestPlans(input));
  });

  it('finishes every combination within 50 ms', () => {
    for (const objective of OBJECTIVES) {
      for (const preference of PREFERENCES) {
        const start = performance.now();
        suggestPlans({ courses, locked: [], objective, preference });
        expect(performance.now() - start).toBeLessThan(50);
      }
    }
  });
});

describe('suggestPlans on synthetic courses', () => {
  it('reports an exam overlap every section shares with a named course', () => {
    const exam = { midterm: MIDTERM };
    const a = curriculumCourse('11111111', [
      { exam, meetings: [makeMeeting({ day: 1 })] },
      { exam, meetings: [makeMeeting({ day: 2 })] },
    ]);
    const b = curriculumCourse('22222222', [
      { exam, meetings: [makeMeeting({ day: 3 })] },
      { exam, meetings: [makeMeeting({ day: 4 })] },
    ]);
    const sameDay = curriculumCourse('33333333', [
      {
        exam: {
          midterm: {
            start: '2026-08-17 13:30:00',
            end: '2026-08-17 16:30:00',
          },
        },
        meetings: [makeMeeting({ day: 5 })],
      },
    ]);
    const [best] = suggestPlans({
      courses: [a, b, sameDay],
      locked: [],
      objective: 'coverAll',
      preference: 'balanced',
    }).suggestions;
    expect(best?.choices.map((c) => c.course.subjectId)).toEqual([
      '11111111',
      '33333333',
    ]);
    expect(best?.leftOut).toHaveLength(1);
    expect(best?.leftOut[0]?.reason).toMatchObject({
      kind: 'exam',
      blocking: { subjectId: '11111111' },
    });
  });

  it('names a locked entry whose exam every section overlaps', () => {
    const exam = { midterm: MIDTERM };
    const gened = makeCourse({
      subjectId: '90000009',
      sections: [makeSection({ subjectId: '90000009', exam })],
    });
    const lockedSection = gened.sections[0];
    if (lockedSection === undefined) {
      throw new Error('no GenEd section');
    }
    const outcome = addSectionGroup(
      [],
      gened,
      lockedSection,
      SUGGEST_QUERY,
      SUGGEST_NOW,
      SUGGEST_TERM,
    );
    if (!outcome.ok) {
      throw new Error('cannot lock the GenEd');
    }
    const clashing = curriculumCourse('12121212', [
      { exam, meetings: [makeMeeting({ day: 2 })] },
      { exam, meetings: [makeMeeting({ day: 3 })] },
    ]);
    const [best] = suggestPlans({
      courses: [clashing],
      locked: outcome.result.entries,
      objective: 'coverAll',
      preference: 'balanced',
    }).suggestions;
    expect(best?.choices).toEqual([]);
    expect(best?.leftOut[0]?.reason).toMatchObject({
      kind: 'exam',
      blocking: { subjectId: '90000009' },
    });
  });

  it('reports the seat reason for a course whose sections are full or closed', () => {
    const full = curriculumCourse('44444444', [
      { seats: { limit: 40, preCount: 0, queueLeft: 0, enrolled: 'full' } },
      { isClosed: true },
    ]);
    const { suggestions } = suggestPlans({
      courses: [full],
      locked: [],
      objective: 'coverAll',
      preference: 'balanced',
    });
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.choices).toEqual([]);
    expect(suggestions[0]?.leftOut[0]?.reason).toEqual({ kind: 'seats' });
  });

  it('reports no fit for a course that clashes only with the chosen set', () => {
    const slot = [makeMeeting({ day: 1, startMin: 540, endMin: 720 })];
    const first = curriculumCourse('55555555', [{ meetings: slot }], 3);
    const second = curriculumCourse('66666666', [{ meetings: slot }], 2);
    const result = suggestPlans({
      courses: [second, first],
      locked: [],
      objective: 'maxCredits',
      preference: 'balanced',
    });
    expect(
      result.suggestions.map((s) => s.choices.map((c) => c.course.subjectId)),
    ).toEqual([['55555555'], ['66666666']]);
    expect(result.suggestions[0]?.leftOut[0]?.reason).toEqual({
      kind: 'noFit',
    });
  });

  it('chooses a declared pair together and skips a pair with a full half', () => {
    const paired = curriculumCourse('77777777', [
      { pairedSection: '2', meetings: [makeMeeting({ day: 1 })] },
      {
        kind: 'practice',
        pairedSection: '1',
        meetings: [makeMeeting({ day: 2 })],
      },
      {
        pairedSection: '4',
        meetings: [makeMeeting({ day: 3, startMin: 480, endMin: 540 })],
      },
      {
        kind: 'practice',
        pairedSection: '3',
        isClosed: true,
        meetings: [makeMeeting({ day: 4 })],
      },
    ]);
    const { suggestions } = suggestPlans({
      courses: [paired],
      locked: [],
      objective: 'coverAll',
      preference: 'morning',
    });
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.choices[0]?.group.map((s) => s.section)).toEqual([
      '1',
      '2',
    ]);
  });

  it('ignores general courses', () => {
    const general = makeCourse({ subjectId: '88888888' });
    const { suggestions } = suggestPlans({
      courses: [general],
      locked: [],
      objective: 'coverAll',
      preference: 'balanced',
    });
    expect(suggestions.map((s) => [s.choices, s.leftOut])).toEqual([[[], []]]);
  });

  // The default cap is the subject here, so the test walks every one of its nodes;
  // the timeout leaves room for a loaded runner.
  it('stops at the node cap on a large input and marks the result truncated', () => {
    const courses = Array.from({ length: 30 }, (_, i) =>
      curriculumCourse(
        String(10_000_000 + i),
        [1, 2, 3, 4].map((day) => ({
          meetings: [
            makeMeeting({
              day: day as 1 | 2 | 3 | 4,
              startMin: 420 + i * 30,
              endMin: 450 + i * 30,
            }),
          ],
        })),
      ),
    );
    const result = suggestPlans({
      courses,
      locked: [],
      objective: 'coverAll',
      preference: 'compact',
    });
    expect(result.truncated).toBe(true);
    expect(result.nodes).toBe(SUGGEST_NODE_CAP);
    expect(result.suggestions).toHaveLength(3);
    for (const suggestion of result.suggestions) {
      expect(suggestion.choices).toHaveLength(30);
      expect(passesAsAWhole([], suggestion)).toBe(true);
    }
  }, 15_000);
});
