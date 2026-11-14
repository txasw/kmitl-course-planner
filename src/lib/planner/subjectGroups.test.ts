import { describe, it, expect } from 'vitest';
import type { PlanEntry } from '../domain/plan';
import {
  makePlanEntry,
  makeSection,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import { groupEntriesBySubject } from './subjectGroups';

function entry(
  teachTableId: string,
  subjectId: string,
  section: string,
): PlanEntry {
  return makePlanEntry({
    snapshot: makeSnapshot(makeSection({ teachTableId, subjectId, section })),
  });
}

describe('groupEntriesBySubject', () => {
  it('orders subjects by id and each subject by section code', () => {
    const groups = groupEntriesBySubject([
      entry('b2', '90000002', '12'),
      entry('a1', '90000001', '901'),
      entry('b1', '90000002', '2'),
    ]);
    expect(groups.map((group) => group.subjectId)).toEqual([
      '90000001',
      '90000002',
    ]);
    expect(groups[1]?.entries.map((e) => e.snapshot.section)).toEqual([
      '2',
      '12',
    ]);
  });

  it('returns no group for an empty plan', () => {
    expect(groupEntriesBySubject([])).toEqual([]);
  });
});
