import { describe, expect, it } from 'vitest';
import {
  makeCourse,
  makeMeeting,
  makeSection,
} from '../../../tests/support/domain-builders';
import { EMPTY_FILTER, filterCourses, type SectionPredicates } from './filter';

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
});
