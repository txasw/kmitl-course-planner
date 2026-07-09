import { describe, expect, it } from 'vitest';
import {
  makeCourse,
  makeMeeting,
  makeSection,
} from '../../../tests/support/domain-builders';
import { computeSectionRelation } from './sectionState';

describe('computeSectionRelation', () => {
  it('is addable against an empty plan', () => {
    const section = makeSection();
    const course = makeCourse({ sections: [section] });
    expect(computeSectionRelation([], course, section)).toEqual({
      kind: 'addable',
    });
  });

  it('is added when the section is already placed by durable identity', () => {
    const section = makeSection({ subjectId: '90000001', section: '901' });
    const course = makeCourse({ subjectId: '90000001', sections: [section] });
    const placed = [
      makeSection({
        subjectId: '90000001',
        section: '901',
        teachTableId: 'placed',
      }),
    ];
    expect(computeSectionRelation(placed, course, section)).toEqual({
      kind: 'added',
    });
  });

  it('is duplicate for another section of a placed subject', () => {
    const section = makeSection({
      subjectId: '90000001',
      section: '901',
      teachTableId: 't2',
      meetings: [makeMeeting({ day: 1 })],
    });
    const course = makeCourse({ subjectId: '90000001', sections: [section] });
    const placed = [
      makeSection({
        subjectId: '90000001',
        section: '801',
        teachTableId: 'placed',
        meetings: [makeMeeting({ day: 2 })],
      }),
    ];
    expect(computeSectionRelation(placed, course, section)).toEqual({
      kind: 'duplicate',
      subjectId: '90000001',
    });
  });

  it('is conflicting when it overlaps a different subject in time', () => {
    const section = makeSection({
      subjectId: '90000001',
      section: '901',
      teachTableId: 't2',
      meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 720 })],
    });
    const course = makeCourse({ subjectId: '90000001', sections: [section] });
    const placed = [
      makeSection({
        subjectId: '90000002',
        section: '901',
        teachTableId: 'placed',
        meetings: [makeMeeting({ day: 1, startMin: 600, endMin: 660 })],
      }),
    ];
    const relation = computeSectionRelation(placed, course, section);
    expect(relation.kind).toBe('conflicting');
    if (relation.kind === 'conflicting') {
      expect(relation.conflicts.length).toBeGreaterThan(0);
    }
  });

  it('is different_term when the browsed term differs from the plan term', () => {
    const section = makeSection();
    const course = makeCourse({ sections: [section] });
    const relation = computeSectionRelation([], course, section, {
      planTerm: { year: '2569', semester: '1' },
      browsedTerm: { year: '2569', semester: '2' },
    });
    expect(relation).toEqual({
      kind: 'different_term',
      planTerm: { year: '2569', semester: '1' },
      browsedTerm: { year: '2569', semester: '2' },
    });
  });

  it('ignores the term check when the terms match or a side is null', () => {
    const section = makeSection();
    const course = makeCourse({ sections: [section] });
    const term = { year: '2569', semester: '1' as const };
    expect(
      computeSectionRelation([], course, section, {
        planTerm: term,
        browsedTerm: term,
      }).kind,
    ).toBe('addable');
    expect(
      computeSectionRelation([], course, section, {
        planTerm: null,
        browsedTerm: term,
      }).kind,
    ).toBe('addable');
  });
});
