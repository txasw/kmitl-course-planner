import { describe, expect, it } from 'vitest';
import { makeCourse } from '../../../tests/support/domain-builders';
import { findCourseBySubjectId } from './findCourse';

describe('findCourseBySubjectId', () => {
  it('returns the course whose subject id matches', () => {
    const a = makeCourse({ subjectId: '90000001' });
    const b = makeCourse({ subjectId: '90000002' });
    expect(findCourseBySubjectId([a, b], '90000002')).toBe(b);
  });

  it('returns null when no course matches', () => {
    const a = makeCourse({ subjectId: '90000001' });
    expect(findCourseBySubjectId([a], '90000009')).toBeNull();
  });

  it('returns null for an empty catalog', () => {
    expect(findCourseBySubjectId([], '90000001')).toBeNull();
  });
});
