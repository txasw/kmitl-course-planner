import { describe, expect, it } from 'vitest';
import {
  makeCourse,
  makeMeeting,
  makeSection,
} from '../../../tests/support/domain-builders';
import type { NormalizedCatalog } from '../domain/normalize';
import type { Course } from '../domain/types';
import { networkError } from '../utils/result';
import { catalogMeetings } from './catalogMeetings';

function catalog(courses: Course[]): NormalizedCatalog {
  return { courses, duplicateCount: 0, multiMeetingCount: 0, warnings: [] };
}

describe('catalogMeetings', () => {
  it('collects every meeting of every section in a ready result', () => {
    const monday = makeMeeting({ day: 1, startMin: 540, endMin: 600 });
    const saturday = makeMeeting({ day: 6, startMin: 1080, endMin: 1200 });
    const evening = makeMeeting({ day: 3, startMin: 1140, endMin: 1260 });
    const result = catalog([
      makeCourse({
        subjectId: '90000001',
        sections: [
          makeSection({ teachTableId: 'a', meetings: [monday, saturday] }),
        ],
      }),
      makeCourse({
        subjectId: '90000002',
        sections: [
          makeSection({ teachTableId: 'b', meetings: [evening] }),
          makeSection({ teachTableId: 'c', meetings: [] }),
        ],
      }),
    ]);
    expect(catalogMeetings({ status: 'ready', data: result })).toEqual([
      monday,
      saturday,
      evening,
    ]);
  });

  it('contributes nothing while no result is ready', () => {
    expect(catalogMeetings({ status: 'idle' })).toEqual([]);
    expect(catalogMeetings({ status: 'loading' })).toEqual([]);
    expect(
      catalogMeetings({ status: 'error', error: networkError('offline') }),
    ).toEqual([]);
  });
});
