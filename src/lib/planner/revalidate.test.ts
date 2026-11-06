import { describe, it, expect } from 'vitest';
import {
  makeCourse,
  makePlan,
  makePlanEntry,
  makeSection,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import { buildSectionIndex } from './revalidateDiff';
import { revalidatePlan } from './revalidate';

describe('revalidatePlan', () => {
  it('summarizes outcomes across all entries', () => {
    const present = makePlanEntry({ snapshot: makeSnapshot() });
    const gone = makePlanEntry({
      snapshot: makeSnapshot({
        teachTableId: 'g1',
        subjectId: 'GONE',
        section: '800',
      }),
    });
    const plan = makePlan({ entries: [present, gone] });
    const index = buildSectionIndex([
      {
        courses: [makeCourse({ sections: [makeSection()] })],
        duplicateCount: 0,
        multiMeetingCount: 0,
        warnings: [],
      },
    ]);
    const result = revalidatePlan(plan, index);
    expect(result.summary).toEqual({
      total: 2,
      unchanged: 1,
      changed: 0,
      missing: 1,
    });
  });
});
