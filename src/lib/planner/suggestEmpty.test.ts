import { describe, expect, it } from 'vitest';
import {
  makeMeeting,
  makePlanEntry,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import {
  byClassCourses,
  curriculumCourse,
  lockSections,
} from '../../../tests/support/suggest';
import { suggestPlans } from './suggest';
import { suggestEmptyReason } from './suggestEmpty';
import { defaultSuggestSubjects, suggestableCourses } from './suggestSubjects';

/** The reason for a search over the default tick list, or the given one. */
function reasonFor(input: Parameters<typeof suggestPlans>[0]) {
  const groups = suggestableCourses(input.courses, input.entries);
  const subjects =
    input.subjects ?? defaultSuggestSubjects(input.courses, input.entries);
  const tickable = [...groups.curriculum, ...groups.other];
  return suggestEmptyReason(suggestPlans({ ...input, subjects }), {
    tickable: tickable.length,
    ticked: tickable.filter((course) => subjects.has(course.subjectId)).length,
  });
}

describe('suggestEmptyReason', () => {
  it('is null when a timetable chooses a course', () => {
    expect(
      reasonFor({
        courses: byClassCourses(),
        entries: [],
        objective: 'coverAll',
        preference: 'balanced',
      }),
    ).toBeNull();
  });

  it('names a result whose courses are all in the plan', () => {
    const courses = [curriculumCourse('11111111', [{}])];
    expect(
      reasonFor({
        courses,
        entries: lockSections(courses, [['11111111', '1']]),
        objective: 'coverAll',
        preference: 'balanced',
      }),
    ).toBe('allPlaced');
  });

  it('offers no reshuffle once the curriculum courses are all in the plan', () => {
    const courses = byClassCourses();
    const locked = lockSections(courses, [
      ['01006020', '4'],
      ['01006021', '5'],
      ['01006030', '33'],
      ['01006503', '1'],
      ['01476012', '33'],
      ['01476101', '33'],
    ]);
    expect(
      reasonFor({
        courses,
        entries: locked,
        objective: 'coverAll',
        preference: 'balanced',
      }),
    ).toBe('planFits');
  });

  it('says the plan already fits when only plan subjects that cannot move are ticked', () => {
    const courses = [
      curriculumCourse('11111111', [{}]),
      curriculumCourse('22222222', [{ meetings: [makeMeeting({ day: 3 })] }]),
    ];
    expect(
      reasonFor({
        courses,
        subjects: new Set(['11111111']),
        entries: lockSections(courses, [['11111111', '1']]),
        objective: 'coverAll',
        preference: 'balanced',
      }),
    ).toBe('planFits');
  });

  it('names ticked plan subjects that cannot all fit together', () => {
    const clash = (subjectId: string, teachTableId: string) =>
      makePlanEntry({
        snapshot: makeSnapshot({
          subjectId,
          teachTableId,
          meetings: [makeMeeting({ day: 4 })],
        }),
      });
    expect(
      reasonFor({
        courses: [curriculumCourse('11111111', [{}])],
        entries: [clash('44444444', 'c1'), clash('55555555', 'c2')],
        objective: 'coverAll',
        preference: 'balanced',
      }),
    ).toBe('planClash');
  });

  it('asks for a tick when the student clears every subject', () => {
    expect(
      reasonFor({
        courses: byClassCourses(),
        subjects: new Set(),
        entries: [],
        objective: 'coverAll',
        preference: 'balanced',
      }),
    ).toBe('noneTicked');
  });

  it('names full or closed sections when no other reason applies', () => {
    const full = curriculumCourse('44444444', [
      { seats: { limit: 40, preCount: 0, queueLeft: 0, enrolled: 'full' } },
      { isClosed: true },
    ]);
    expect(
      reasonFor({
        courses: [full],
        entries: [],
        objective: 'coverAll',
        preference: 'balanced',
      }),
    ).toBe('seats');
  });

  it('names a clash with the plan', () => {
    const slot = [makeMeeting({ day: 1, startMin: 540, endMin: 720 })];
    const placed = curriculumCourse('55555555', [{ meetings: slot }]);
    const clashing = curriculumCourse('66666666', [{ meetings: slot }]);
    const full = curriculumCourse('77777777', [{ isClosed: true }]);
    const courses = [placed, clashing, full];
    expect(
      reasonFor({
        courses,
        entries: lockSections(courses, [['55555555', '1']]),
        objective: 'coverAll',
        preference: 'balanced',
      }),
    ).toBe('conflicts');
  });
});
