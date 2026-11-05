import { describe, it, expect } from 'vitest';
import { loadFixture } from '../../../tests/support/fixtures';
import { makeCourse } from '../../../tests/support/domain-builders';
import { normalizeTeachTable } from '../domain/normalize';
import { classifySubjectGroup, isCurriculumCourse } from './subjectGroup';

const GROUP_1_TH = 'กลุ่ม 1 (วิชา GenEd / วิชาเลือกเสรี)';
const GROUP_1_EN = 'Group 1 (General Education / Elective Subject)';
const GROUP_2_TH =
  'กลุ่ม 2 (วิชาบังคับคณะฯ / วิชาบังคับหลักสูตร / วิชาเลือกหลักสูตร)';
const GROUP_2_EN =
  'Group 2 (Required Subject / Compulsory Courses / Elective Courses)';

function classify(groupNameTh: string, groupNameEn: string): string {
  return classifySubjectGroup({ groupNameTh, groupNameEn });
}

describe('classifySubjectGroup', () => {
  it('reads the captured headings', () => {
    expect(classify(GROUP_2_TH, GROUP_2_EN)).toBe('curriculum');
    expect(classify(GROUP_1_TH, GROUP_1_EN)).toBe('general');
  });

  it('falls back to the other language when one heading is unreadable', () => {
    expect(classify('', GROUP_2_EN)).toBe('curriculum');
    expect(classify(GROUP_1_TH, 'Other')).toBe('general');
    expect(classify('กลุ่ม2', 'GROUP 2')).toBe('curriculum');
  });

  it('treats a missing, unexpected, or contradictory heading as unknown', () => {
    expect(classify('', '')).toBe('unknown');
    expect(classify('กลุ่ม 3', 'Group 3')).toBe('unknown');
    expect(classify('กลุ่ม 12', 'Group 21')).toBe('unknown');
    expect(classify('วิชา กลุ่ม 2', 'Subject group 2')).toBe('unknown');
    expect(classify(GROUP_2_TH, GROUP_1_EN)).toBe('unknown');
  });

  it('splits the by_class capture into six curriculum and six general courses', () => {
    const result = normalizeTeachTable(
      loadFixture('teach-table.by_class.capture.json'),
    );
    if (!result.ok) {
      throw new Error('by_class capture failed to normalize');
    }
    const kinds = result.value.courses.map((course) =>
      classifySubjectGroup(course),
    );
    expect(kinds.filter((kind) => kind === 'curriculum')).toHaveLength(6);
    expect(kinds.filter((kind) => kind === 'general')).toHaveLength(6);
  });
});

describe('isCurriculumCourse', () => {
  it('accepts only a curriculum course', () => {
    expect(
      isCurriculumCourse(
        makeCourse({ groupNameTh: GROUP_2_TH, groupNameEn: GROUP_2_EN }),
      ),
    ).toBe(true);
    expect(
      isCurriculumCourse(
        makeCourse({ groupNameTh: GROUP_1_TH, groupNameEn: GROUP_1_EN }),
      ),
    ).toBe(false);
    expect(
      isCurriculumCourse(makeCourse({ groupNameTh: '', groupNameEn: '' })),
    ).toBe(false);
  });
});
