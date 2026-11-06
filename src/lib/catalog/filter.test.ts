import { describe, expect, it } from 'vitest';
import {
  makeCourse,
  makeMeeting,
  makeSection,
} from '../../../tests/support/domain-builders';
import { loadFixture } from '../../../tests/support/fixtures';
import { normalizeTeachTable } from '../domain/normalize';
import type { OfferedTo } from '../domain/types';
import type { CurriculumProfile } from './curriculumProfile';
import {
  EMPTY_FILTER,
  filterCourses,
  matchesOfferedTo,
  type SectionPredicates,
} from './filter';

const NO_PREDICATES: SectionPredicates = {
  isFull: () => false,
  isConflicting: () => false,
};

const physics = makeCourse({
  subjectId: '90592033',
  nameTh: 'ฟิสิกส์',
  nameEn: 'Physics',
  credit: 3,
  sections: [
    makeSection({
      teachTableId: 'a',
      section: '901',
      meetings: [makeMeeting({ day: 1 })],
    }),
    makeSection({
      teachTableId: 'b',
      section: '902',
      meetings: [makeMeeting({ day: 3 })],
    }),
  ],
});
const english = makeCourse({
  subjectId: '90000010',
  nameTh: 'ภาษาอังกฤษ',
  nameEn: 'English',
  credit: 2,
  sections: [
    makeSection({
      teachTableId: 'c',
      section: '801',
      meetings: [makeMeeting({ day: 5 })],
    }),
  ],
});
const courses = [physics, english];

describe('filterCourses', () => {
  it('returns every course with an empty filter', () => {
    expect(filterCourses(courses, EMPTY_FILTER, NO_PREDICATES)).toHaveLength(2);
  });

  it('matches free text against subject id and both names', () => {
    expect(
      filterCourses(
        courses,
        { ...EMPTY_FILTER, text: 'physics' },
        NO_PREDICATES,
      ),
    ).toHaveLength(1);
    expect(
      filterCourses(courses, { ...EMPTY_FILTER, text: 'ภาษา' }, NO_PREDICATES),
    ).toHaveLength(1);
    expect(
      filterCourses(courses, { ...EMPTY_FILTER, text: '9059' }, NO_PREDICATES),
    ).toHaveLength(1);
  });

  it('filters by credit', () => {
    const result = filterCourses(
      courses,
      { ...EMPTY_FILTER, credit: 2 },
      NO_PREDICATES,
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.subjectId).toBe('90000010');
  });

  it('keeps only sections meeting on a selected day', () => {
    const result = filterCourses(
      courses,
      { ...EMPTY_FILTER, days: [1] },
      NO_PREDICATES,
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.sections).toHaveLength(1);
    expect(result[0]?.sections[0]?.section).toBe('901');
  });

  it('hides full sections and drops empty courses', () => {
    const predicates: SectionPredicates = {
      isFull: (section) => section.section === '801',
      isConflicting: () => false,
    };
    const result = filterCourses(
      courses,
      { ...EMPTY_FILTER, hideFull: true },
      predicates,
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.subjectId).toBe('90592033');
  });

  it('hides conflicting sections', () => {
    const predicates: SectionPredicates = {
      isFull: () => false,
      isConflicting: (_course, section) => section.section === '902',
    };
    const result = filterCourses(
      courses,
      { ...EMPTY_FILTER, hideConflicting: true },
      predicates,
    );
    expect(result[0]?.sections).toHaveLength(1);
    expect(result[0]?.sections[0]?.section).toBe('901');
  });

  it('keeps the original course reference when no section is dropped', () => {
    // Identity preservation lets a memoized card skip a re-filter that changes
    // nothing about a course, so the reference must be the same object.
    const result = filterCourses(courses, EMPTY_FILTER, NO_PREDICATES);
    expect(result[0]).toBe(physics);
    expect(result[1]).toBe(english);
  });

  it('returns a fresh course object only when a section is dropped', () => {
    const result = filterCourses(
      courses,
      { ...EMPTY_FILTER, days: [1] },
      NO_PREDICATES,
    );
    // Physics lost its day 3 section, so it is a new object; its identity must not
    // alias the input, since the memoized card does need to re-render here.
    expect(result[0]).not.toBe(physics);
    expect(result[0]?.subjectId).toBe('90592033');
  });

  it('hides unscheduled sections with no meetings', () => {
    const online = makeCourse({
      subjectId: '01006029',
      sections: [
        makeSection({ teachTableId: 'o', section: '1', meetings: [] }),
      ],
    });
    const withOnline = [...courses, online];
    expect(filterCourses(withOnline, EMPTY_FILTER, NO_PREDICATES)).toHaveLength(
      3,
    );
    const hidden = filterCourses(
      withOnline,
      { ...EMPTY_FILTER, hideUnscheduled: true },
      NO_PREDICATES,
    );
    expect(hidden).toHaveLength(2);
    expect(hidden.some((course) => course.subjectId === '01006029')).toBe(
      false,
    );
  });
});

describe('matchesOfferedTo', () => {
  const profile: CurriculumProfile = {
    facultyId: '01',
    departmentId: '05',
    curriculumId: '137',
    classYear: '1',
  };
  const grouping = (
    facultyId: string,
    departmentId: string,
    curriculumId: string,
    classYear: string,
  ): OfferedTo => ({ facultyId, departmentId, curriculumId, classYear });

  it('matches the exact grouping and rejects another year or curriculum', () => {
    expect(matchesOfferedTo([grouping('01', '05', '137', '1')], profile)).toBe(
      true,
    );
    expect(matchesOfferedTo([grouping('01', '05', '137', '2')], profile)).toBe(
      false,
    );
    expect(matchesOfferedTo([grouping('01', '05', '06', '1')], profile)).toBe(
      false,
    );
  });

  it('compares unpadded ids by value', () => {
    expect(matchesOfferedTo([grouping('1', '5', '137', '01')], profile)).toBe(
      true,
    );
    expect(
      matchesOfferedTo([grouping('01', '05', '06', '1')], {
        ...profile,
        curriculumId: '6',
      }),
    ).toBe(true);
  });

  it('reads x and class 0 on the data side as any', () => {
    expect(matchesOfferedTo([grouping('01', 'x', 'x', '0')], profile)).toBe(
      true,
    );
    expect(matchesOfferedTo([grouping('01', 'x', 'x', '4')], profile)).toBe(
      false,
    );
    expect(matchesOfferedTo([grouping('01', '05', 'x', '1')], profile)).toBe(
      true,
    );
  });

  it('never lets a wildcard cross into another faculty', () => {
    expect(matchesOfferedTo([grouping('02', 'x', 'x', '0')], profile)).toBe(
      false,
    );
  });

  it('matches when any one grouping matches', () => {
    expect(
      matchesOfferedTo(
        [grouping('03', '01', '34', '1'), grouping('01', '05', '137', '1')],
        profile,
      ),
    ).toBe(true);
    expect(matchesOfferedTo([], profile)).toBe(false);
  });

  it('keeps a section that has no list to judge', () => {
    expect(matchesOfferedTo(undefined, profile)).toBe(true);
  });

  it('narrows the subject id capture to the curriculum and year', () => {
    const result = normalizeTeachTable(
      loadFixture('teach-table.by_subject_id.capture.json'),
    );
    if (!result.ok) {
      throw new Error('fixture failed to normalize');
    }
    const all = result.value.courses.flatMap((course) => course.sections);
    const kept = filterCourses(
      result.value.courses,
      { ...EMPTY_FILTER, curriculum: profile },
      NO_PREDICATES,
    ).flatMap((course) => course.sections);
    expect(kept.length).toBeGreaterThan(0);
    expect(kept.length).toBeLessThan(all.length);
    for (const section of kept) {
      expect(matchesOfferedTo(section.offeredTo, profile)).toBe(true);
    }
  });
});
