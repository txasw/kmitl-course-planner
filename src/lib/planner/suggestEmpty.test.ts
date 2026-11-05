import { describe, expect, it } from 'vitest';
import { makeMeeting } from '../../../tests/support/domain-builders';
import {
  byClassCourses,
  curriculumCourse,
  lockSections,
} from '../../../tests/support/suggest';
import { suggestPlans } from './suggest';
import { suggestEmptyReason } from './suggestEmpty';

function reasonFor(...args: Parameters<typeof suggestPlans>) {
  return suggestEmptyReason(suggestPlans(...args));
}

describe('suggestEmptyReason', () => {
  it('is null when a timetable chooses a course', () => {
    expect(
      reasonFor({
        courses: byClassCourses(),
        locked: [],
        objective: 'coverAll',
        preference: 'balanced',
      }),
    ).toBeNull();
  });

  it('names a result whose curriculum courses are all in the plan', () => {
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
        locked,
        objective: 'coverAll',
        preference: 'balanced',
      }),
    ).toBe('allPlaced');
  });

  it('names full or closed sections when no other reason applies', () => {
    const full = curriculumCourse('44444444', [
      { seats: { limit: 40, preCount: 0, queueLeft: 0, enrolled: 'full' } },
      { isClosed: true },
    ]);
    expect(
      reasonFor({
        courses: [full],
        locked: [],
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
        locked: lockSections(courses, [['55555555', '1']]),
        objective: 'coverAll',
        preference: 'balanced',
      }),
    ).toBe('conflicts');
  });
});
