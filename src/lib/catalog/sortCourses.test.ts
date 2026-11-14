import { describe, expect, it } from 'vitest';
import {
  makeCourse,
  makeMeeting,
  makeSection,
} from '../../../tests/support/domain-builders';
import { earliestStartMinute, openSeatCount, sortCourses } from './sortCourses';

function withSeats(
  limit: number | null,
  enrolled: number | 'full',
  isClosed = false,
) {
  return makeSection({
    seats: { limit, preCount: 0, queueLeft: 0, enrolled },
    isClosed,
  });
}

function ids(courses: readonly { subjectId: string }[]): string[] {
  return courses.map((course) => course.subjectId);
}

describe('openSeatCount', () => {
  it('sums the remaining seats of the open sections only', () => {
    const course = makeCourse({
      sections: [
        withSeats(40, 30),
        withSeats(20, 5),
        withSeats(40, 'full'),
        withSeats(40, 0, true),
      ],
    });
    expect(openSeatCount(course)).toBe(25);
  });

  it('treats an open uncapped section as unlimited', () => {
    const course = makeCourse({
      sections: [withSeats(40, 10), withSeats(null, 3)],
    });
    expect(openSeatCount(course)).toBe(Number.POSITIVE_INFINITY);
  });

  it('counts nothing when every section is full or closed', () => {
    const course = makeCourse({
      sections: [withSeats(40, 'full'), withSeats(null, 0, true)],
    });
    expect(openSeatCount(course)).toBe(0);
  });
});

describe('earliestStartMinute', () => {
  it('takes the first meeting in week order across every section', () => {
    const course = makeCourse({
      sections: [
        makeSection({
          meetings: [makeMeeting({ day: 3, startMin: 480, endMin: 600 })],
        }),
        makeSection({
          meetings: [
            makeMeeting({ day: 5, startMin: 420, endMin: 540 }),
            makeMeeting({ day: 2, startMin: 780, endMin: 900 }),
          ],
        }),
      ],
    });
    expect(earliestStartMinute(course)).toBe(2 * 1440 + 780);
  });

  it('ranks a course with no meeting after every scheduled one', () => {
    const course = makeCourse({
      sections: [makeSection({ meetings: [] })],
    });
    expect(earliestStartMinute(course)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('sortCourses', () => {
  const b = makeCourse({
    subjectId: '90000002',
    sections: [
      makeSection({
        seats: { limit: 40, preCount: 0, queueLeft: 0, enrolled: 35 },
        meetings: [makeMeeting({ day: 1, startMin: 780, endMin: 900 })],
      }),
    ],
  });
  const a = makeCourse({
    subjectId: '90000001',
    sections: [
      makeSection({
        seats: { limit: 40, preCount: 0, queueLeft: 0, enrolled: 10 },
        meetings: [makeMeeting({ day: 4, startMin: 480, endMin: 600 })],
      }),
    ],
  });
  const c = makeCourse({
    subjectId: '90000003',
    sections: [
      makeSection({
        seats: { limit: null, preCount: 0, queueLeft: 0, enrolled: 0 },
        meetings: [],
      }),
    ],
  });

  it('orders by subject id', () => {
    expect(ids(sortCourses([c, b, a], 'subjectId'))).toEqual([
      '90000001',
      '90000002',
      '90000003',
    ]);
  });

  it('orders by the most open seats, unlimited first', () => {
    expect(ids(sortCourses([a, b, c], 'openSeats'))).toEqual([
      '90000003',
      '90000001',
      '90000002',
    ]);
  });

  it('orders by the earliest start, unscheduled last', () => {
    expect(ids(sortCourses([c, a, b], 'earliestStart'))).toEqual([
      '90000002',
      '90000001',
      '90000003',
    ]);
  });

  it('breaks a tie by subject id', () => {
    const late = makeCourse({ subjectId: '90000009' });
    const early = makeCourse({ subjectId: '90000004' });
    const unlimited = makeCourse({
      subjectId: '90000008',
      sections: [withSeats(null, 0)],
    });
    const alsoUnlimited = makeCourse({
      subjectId: '90000007',
      sections: [withSeats(null, 0)],
    });
    expect(ids(sortCourses([late, early], 'earliestStart'))).toEqual([
      '90000004',
      '90000009',
    ]);
    expect(ids(sortCourses([unlimited, alsoUnlimited], 'openSeats'))).toEqual([
      '90000007',
      '90000008',
    ]);
  });

  it('leaves the input array as it was', () => {
    const input = [c, b, a];
    sortCourses(input, 'subjectId');
    expect(ids(input)).toEqual(['90000003', '90000002', '90000001']);
  });
});
