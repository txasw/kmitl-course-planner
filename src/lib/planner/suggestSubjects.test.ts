import { describe, it, expect } from 'vitest';
import {
  makeCourse,
  makePlanEntry,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import { curriculumCourse } from '../../../tests/support/suggest';
import { defaultSuggestSubjects, suggestableCourses } from './suggestSubjects';

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

describe('suggestableCourses', () => {
  it('splits the result into curriculum and other courses in result order', () => {
    const groups = suggestableCourses([gened, required, unknown, elective], []);
    expect(groups.curriculum.map((c) => c.subjectId)).toEqual([
      '11111111',
      '22222222',
    ]);
    expect(groups.other.map((c) => c.subjectId)).toEqual([
      '90000001',
      '90000002',
    ]);
  });

  it('leaves out the subjects already in the plan', () => {
    const groups = suggestableCourses([required, placed], [entry]);
    expect(groups.curriculum.map((c) => c.subjectId)).toEqual(['11111111']);
  });
});

describe('defaultSuggestSubjects', () => {
  it('ticks only the curriculum subjects not in the plan', () => {
    expect([
      ...defaultSuggestSubjects([gened, required, placed, elective], [entry]),
    ]).toEqual(['11111111', '22222222']);
  });
});
