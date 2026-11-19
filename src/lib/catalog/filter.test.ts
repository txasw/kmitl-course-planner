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

  it('narrows a course to the sections an instructor teaches', () => {
    const shared = makeCourse({
      subjectId: '90592004',
      nameTh: 'วัฒนธรรมร่วมสมัย',
      nameEn: 'Contemporary Culture',
      sections: [
        makeSection({
          teachTableId: 's1',
          section: '901',
          teachersTh: ['อาจารย์ วัลลภ รุจิขจร', 'รศ. ดร. รวิภัทร ลาภเจริญสุข'],
          teachersEn: [
            'Lecturer Wanlop Ruchikachorn',
            'Mr. RAVIPAT LAPCHAROENSUK',
          ],
        }),
        makeSection({
          teachTableId: 's2',
          section: '902',
          teachersTh: ['อาจารย์ วัลลภ รุจิขจร'],
          teachersEn: ['Lecturer Wanlop Ruchikachorn'],
        }),
      ],
    });
    for (const text of ['ลาภเจริญสุข', 'ravipat', '  RAVIPAT ']) {
      const result = filterCourses(
        [...courses, shared],
        { ...EMPTY_FILTER, text },
        NO_PREDICATES,
      );
      expect(result).toHaveLength(1);
      expect(result[0]?.sections.map((section) => section.section)).toEqual([
        '901',
      ]);
    }
    const both = filterCourses(
      [shared],
      { ...EMPTY_FILTER, text: 'wanlop' },
      NO_PREDICATES,
    );
    expect(both[0]).toBe(shared);
  });

  it('narrows a course to the sections held in a room or building', () => {
    const lab = makeCourse({
      subjectId: '90592033',
      sections: [
        makeSection({
          teachTableId: 'r1',
          section: '901',
          meetings: [makeMeeting({ building: 'D01', room: 'D-110' })],
        }),
        makeSection({
          teachTableId: 'r2',
          section: '902',
          meetings: [makeMeeting({ building: 'E12', room: '505' })],
        }),
      ],
    });
    const byRoom = filterCourses(
      [lab],
      { ...EMPTY_FILTER, text: 'd-110' },
      NO_PREDICATES,
    );
    expect(byRoom[0]?.sections.map((section) => section.section)).toEqual([
      '901',
    ]);
    const byBuilding = filterCourses(
      [lab],
      { ...EMPTY_FILTER, text: 'e12' },
      NO_PREDICATES,
    );
    expect(byBuilding[0]?.sections.map((section) => section.section)).toEqual([
      '902',
    ]);
  });

  it('keeps every section when the text matches the course itself', () => {
    const result = filterCourses(
      courses,
      { ...EMPTY_FILTER, text: '90592033' },
      NO_PREDICATES,
    );
    expect(result).toEqual([physics]);
    expect(result[0]).toBe(physics);
  });

  it('applies the facets on top of an instructor match', () => {
    const result = filterCourses(
      [
        makeCourse({
          sections: [
            makeSection({
              teachTableId: 'f1',
              section: '1',
              teachersEn: ['Mr. RAVIPAT LAPCHAROENSUK'],
              meetings: [makeMeeting({ day: 1 })],
            }),
            makeSection({
              teachTableId: 'f2',
              section: '2',
              teachersEn: ['Mr. RAVIPAT LAPCHAROENSUK'],
              meetings: [makeMeeting({ day: 2 })],
            }),
          ],
        }),
      ],
      { ...EMPTY_FILTER, text: 'ravipat', days: [2] },
      NO_PREDICATES,
    );
    expect(result[0]?.sections.map((section) => section.section)).toEqual([
      '2',
    ]);
  });

  it('finds the multi instructor sections of the subject id capture', () => {
    const result = normalizeTeachTable(
      loadFixture('teach-table.by_subject_id.capture.json'),
    );
    if (!result.ok) {
      throw new Error('fixture failed to normalize');
    }
    const [course] = result.value.courses;
    expect(course?.sections).toHaveLength(44);
    for (const text of ['ravipat', 'ลาภเจริญสุข']) {
      const kept = filterCourses(
        result.value.courses,
        { ...EMPTY_FILTER, text },
        NO_PREDICATES,
      ).flatMap((match) => match.sections);
      expect(kept).toHaveLength(19);
      for (const section of kept) {
        expect(section.teachersEn).toContain('Mr. RAVIPAT LAPCHAROENSUK');
        expect(section.teachersEn.length).toBeGreaterThan(1);
      }
    }
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
