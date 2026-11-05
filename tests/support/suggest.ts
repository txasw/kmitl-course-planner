// Shared inputs for the plan suggestion tests: the by_class capture, a term and
// source query that match it, and builders for locked entries and synthetic
// curriculum courses.

import type { Course, Section } from '../../src/lib/domain/types';
import type { PlanEntry, SourceQuery } from '../../src/lib/domain/plan';
import type { Term } from '../../src/lib/routing/academicTerms';
import { normalizeTeachTable } from '../../src/lib/domain/normalize';
import { addSectionGroup } from '../../src/lib/planner/transaction';
import { makeCourse, makeSection } from './domain-builders';
import { loadFixture } from './fixtures';

export const SUGGEST_TERM: Term = { year: '2569', semester: '1' };

export const SUGGEST_QUERY: SourceQuery = {
  endpoint: 'get-teach-table-show',
  params: { mode: 'by_class', selected_year: '2569', selected_semester: '1' },
};

export const SUGGEST_NOW = '2026-11-06T00:00:00.000Z';

const GROUP_2 = {
  groupNameTh:
    'กลุ่ม 2 (วิชาบังคับคณะฯ / วิชาบังคับหลักสูตร / วิชาเลือกหลักสูตร)',
  groupNameEn:
    'Group 2 (Required Subject / Compulsory Courses / Elective Courses)',
};

/** The courses of the by_class capture: six curriculum and six general. */
export function byClassCourses(): Course[] {
  const result = normalizeTeachTable(
    loadFixture('teach-table.by_class.capture.json'),
  );
  if (!result.ok) {
    throw new Error('by_class capture failed to normalize');
  }
  return result.value.courses;
}

/** Plan entries for the given subject and section picks, added in order. */
export function lockSections(
  courses: Course[],
  picks: [string, string][],
): PlanEntry[] {
  let entries: PlanEntry[] = [];
  for (const [subjectId, code] of picks) {
    const course = courses.find((c) => c.subjectId === subjectId);
    const section = course?.sections.find((s) => s.section === code);
    if (course === undefined || section === undefined) {
      throw new Error(`no section ${subjectId} ${code}`);
    }
    const outcome = addSectionGroup(
      entries,
      course,
      section,
      SUGGEST_QUERY,
      SUGGEST_NOW,
      SUGGEST_TERM,
    );
    if (!outcome.ok) {
      throw new Error(`cannot lock ${subjectId} ${code}`);
    }
    entries = outcome.result.entries;
  }
  return entries;
}

/** A group 2 course whose sections are numbered from 1 in the given order. */
export function curriculumCourse(
  subjectId: string,
  sections: Partial<Section>[],
  credit = 3,
): Course {
  return makeCourse({
    ...GROUP_2,
    subjectId,
    credit,
    sections: sections.map((overrides, index) =>
      makeSection({
        teachTableId: `${subjectId}-${String(index)}`,
        subjectId,
        section: String(index + 1),
        ...overrides,
      }),
    ),
  });
}
