import { describe, it, expect } from 'vitest';
import {
  makeCourse,
  makeMeeting,
  makeSection,
} from '../../../tests/support/domain-builders';
import { alternativeSections } from './suggestions';

describe('alternativeSections', () => {
  it('offers a same subject section that fits, excluding the blocked one', () => {
    const blocked = makeSection({
      teachTableId: 'b',
      section: '901',
      meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 600 })],
    });
    const alternative = makeSection({
      teachTableId: 'a',
      section: '902',
      meetings: [makeMeeting({ day: 2, startMin: 600, endMin: 660 })],
    });
    const course = makeCourse({ sections: [blocked, alternative] });
    const placed = [
      makeSection({
        teachTableId: 'p',
        subjectId: 'OTHER',
        section: '1',
        meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 600 })],
      }),
    ];
    expect(
      alternativeSections(course, placed, blocked).map((s) => s.section),
    ).toEqual(['902']);
  });

  it('orders by earliest start and puts unscheduled last', () => {
    const blocked = makeSection({ teachTableId: 'b', section: '901' });
    const early = makeSection({
      teachTableId: 'e',
      section: '902',
      meetings: [makeMeeting({ day: 2, startMin: 480, endMin: 540 })],
    });
    const late = makeSection({
      teachTableId: 'l',
      section: '903',
      meetings: [makeMeeting({ day: 2, startMin: 600, endMin: 660 })],
    });
    const online = makeSection({
      teachTableId: 'o',
      section: '904',
      meetings: [],
    });
    const course = makeCourse({ sections: [blocked, late, online, early] });
    expect(
      alternativeSections(course, [], blocked).map((s) => s.section),
    ).toEqual(['902', '903']);
  });

  it('caps the alternatives at two', () => {
    const blocked = makeSection({ teachTableId: 'b', section: '901' });
    const course = makeCourse({
      sections: [
        blocked,
        makeSection({
          teachTableId: '2',
          section: '902',
          meetings: [makeMeeting({ day: 2, startMin: 480, endMin: 540 })],
        }),
        makeSection({
          teachTableId: '3',
          section: '903',
          meetings: [makeMeeting({ day: 2, startMin: 540, endMin: 600 })],
        }),
        makeSection({
          teachTableId: '4',
          section: '904',
          meetings: [makeMeeting({ day: 2, startMin: 600, endMin: 660 })],
        }),
      ],
    });
    expect(alternativeSections(course, [], blocked)).toHaveLength(2);
  });

  it('offers none when the subject is already placed', () => {
    const blocked = makeSection({
      teachTableId: 'b',
      subjectId: 'S1',
      section: '901',
    });
    const alternative = makeSection({
      teachTableId: 'a',
      subjectId: 'S1',
      section: '902',
      meetings: [makeMeeting({ day: 3 })],
    });
    const course = makeCourse({
      subjectId: 'S1',
      sections: [blocked, alternative],
    });
    const placed = [
      makeSection({ teachTableId: 'x', subjectId: 'S1', section: '903' }),
    ];
    expect(alternativeSections(course, placed, blocked)).toHaveLength(0);
  });
});
