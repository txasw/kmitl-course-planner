import { describe, it, expect } from 'vitest';
import {
  makeCourse,
  makePlanEntry,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import { curriculumCourse } from '../../../tests/support/suggest';
import {
  defaultSuggestSubjects,
  plannedSubjects,
  suggestableCourses,
} from './suggestSubjects';

const gened = makeCourse({ subjectId: '90000001' });
const unknown = makeCourse({
  subjectId: '90000002',
  groupNameTh: 'วิชาอื่น',
  groupNameEn: 'Other',
});
const required = curriculumCourse('11111111', [{}]);
const elective = curriculumCourse('22222222', [{}]);
const placed = curriculumCourse('33333333', [{}]);
const entry = makePlanEntry({
  snapshot: makeSnapshot({ subjectId: '33333333', teachTableId: 'l1' }),
});
// A GenEd the student added by hand from another search, which this result lacks.
const handAdded = makePlanEntry({
  teachTableId: 'g1',
  subjectId: '90000009',
  snapshot: makeSnapshot({
    subjectId: '90000009',
    teachTableId: 'g1',
    subjectMeta: {
      subjectId: '90000009',
      nameTh: 'วิชาศึกษาทั่วไป',
      nameEn: 'General Education',
      credit: 3,
      creditStr: '3(3-0-6)',
    },
  }),
});

describe('plannedSubjects', () => {
  it('takes the result course of a plan subject the result holds', () => {
    const [subject] = plannedSubjects([required, placed], [entry]);
    expect(subject?.course).toBe(placed);
    expect(subject?.current.map((s) => s.teachTableId)).toEqual(['l1']);
  });

  it('builds a course of the plan sections for a subject the result lacks', () => {
    const [subject] = plannedSubjects([required], [handAdded]);
    expect(subject?.course).toMatchObject({
      subjectId: '90000009',
      nameEn: 'General Education',
      credit: 3,
      creditStr: '3(3-0-6)',
    });
    expect(subject?.course.sections.map((s) => s.teachTableId)).toEqual(['g1']);
  });

  it('holds both halves of a pair under one subject, in plan order', () => {
    const lecture = makePlanEntry({
      teachTableId: 'p1',
      subjectId: '44444444',
      snapshot: makeSnapshot({ subjectId: '44444444', teachTableId: 'p1' }),
    });
    const practice = makePlanEntry({
      teachTableId: 'p2',
      subjectId: '44444444',
      snapshot: makeSnapshot({ subjectId: '44444444', teachTableId: 'p2' }),
    });
    const subjects = plannedSubjects([], [handAdded, lecture, practice]);
    expect(subjects.map((s) => s.course.subjectId)).toEqual([
      '90000009',
      '44444444',
    ]);
    expect(subjects[1]?.current.map((s) => s.teachTableId)).toEqual([
      'p1',
      'p2',
    ]);
  });
});

describe('suggestableCourses', () => {
  it('splits the result into curriculum and other courses in result order', () => {
    const groups = suggestableCourses([gened, required, unknown, elective], []);
    expect(groups.planned).toEqual([]);
    expect(groups.curriculum.map((c) => c.subjectId)).toEqual([
      '11111111',
      '22222222',
    ]);
    expect(groups.other.map((c) => c.subjectId)).toEqual([
      '90000001',
      '90000002',
    ]);
  });

  it('lists the plan subjects as their own group, hand added ones included', () => {
    const groups = suggestableCourses([required, placed], [entry, handAdded]);
    expect(groups.planned.map((c) => c.subjectId)).toEqual([
      '33333333',
      '90000009',
    ]);
    expect(groups.curriculum.map((c) => c.subjectId)).toEqual(['11111111']);
  });
});

describe('defaultSuggestSubjects', () => {
  it('ticks the plan subjects and the curriculum subjects not in the plan', () => {
    expect([
      ...defaultSuggestSubjects(
        [gened, required, placed, elective],
        [entry, handAdded],
      ),
    ]).toEqual(['33333333', '90000009', '11111111', '22222222']);
  });
});
