import { describe, it, expect } from 'vitest';
import type { PlanEntry } from '../domain/plan';
import type { Section } from '../domain/types';
import {
  makeCourse,
  makeMeeting,
  makePlanEntry,
  makeSection,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import { checkPlacement, expandSectionGroup } from './placement';
import { placedSections } from './transaction';
import { replaceOptions } from './sectionChange';

function entryOf(section: Section): PlanEntry {
  return makePlanEntry({
    snapshot: makeSnapshot({
      ...section,
      subjectMeta: {
        subjectId: section.subjectId,
        nameTh: 'วิชา',
        nameEn: 'Subject',
        credit: 3,
        creditStr: '3(3-0-6)',
      },
    }),
  });
}

const MONDAY_NINE = makeMeeting({ day: 1, startMin: 540, endMin: 660 });
const TUESDAY_NINE = makeMeeting({ day: 2, startMin: 540, endMin: 660 });
const WEDNESDAY_NINE = makeMeeting({ day: 3, startMin: 540, endMin: 660 });

/** The conflicts the incoming section raises against the plan, as an add reports them. */
function conflictsOf(entries: PlanEntry[], incoming: Section) {
  const course = makeCourse({
    subjectId: incoming.subjectId,
    sections: [incoming],
  });
  const placement = checkPlacement(
    placedSections(entries),
    expandSectionGroup(course, incoming),
  );
  return { course, conflicts: placement.ok ? [] : placement.conflicts };
}

describe('replaceOptions', () => {
  it('offers the blocking subject with both halves of its pair', () => {
    const lecture = makeSection({
      teachTableId: 'BL',
      subjectId: 'B',
      section: '1',
      pairedSection: '101',
      meetings: [MONDAY_NINE],
    });
    const practice = makeSection({
      teachTableId: 'BP',
      subjectId: 'B',
      section: '101',
      pairedSection: '1',
      meetings: [WEDNESDAY_NINE],
    });
    const entries = [entryOf(lecture), entryOf(practice)];
    const incoming = makeSection({
      teachTableId: 'A',
      subjectId: 'A',
      meetings: [MONDAY_NINE],
    });
    const { course, conflicts } = conflictsOf(entries, incoming);
    expect(replaceOptions(entries, course, incoming, conflicts)).toEqual([
      { subjectId: 'B', sections: ['1', '101'], removeIds: ['BL'] },
    ]);
  });

  it('names a subject once when several of its meetings block', () => {
    const blocker = makeSection({
      teachTableId: 'B',
      subjectId: 'B',
      meetings: [MONDAY_NINE, TUESDAY_NINE],
    });
    const entries = [entryOf(blocker)];
    const incoming = makeSection({
      teachTableId: 'A',
      subjectId: 'A',
      meetings: [MONDAY_NINE, TUESDAY_NINE],
    });
    const { course, conflicts } = conflictsOf(entries, incoming);
    expect(conflicts).toHaveLength(2);
    expect(replaceOptions(entries, course, incoming, conflicts)).toHaveLength(
      1,
    );
  });

  it('offers nothing when the incoming section still clashes with another subject', () => {
    const first = makeSection({
      teachTableId: 'B',
      subjectId: 'B',
      meetings: [MONDAY_NINE],
    });
    const second = makeSection({
      teachTableId: 'C',
      subjectId: 'C',
      meetings: [TUESDAY_NINE],
    });
    const entries = [entryOf(first), entryOf(second)];
    const incoming = makeSection({
      teachTableId: 'A',
      subjectId: 'A',
      meetings: [MONDAY_NINE, TUESDAY_NINE],
    });
    const { course, conflicts } = conflictsOf(entries, incoming);
    expect(replaceOptions(entries, course, incoming, conflicts)).toEqual([]);
  });

  it('offers nothing for a blocker the plan no longer holds', () => {
    const incoming = makeSection({ teachTableId: 'A', subjectId: 'A' });
    const course = makeCourse({ subjectId: 'A', sections: [incoming] });
    const conflicts = [
      {
        kind: 'time' as const,
        blocking: { teachTableId: 'gone', subjectId: 'B', section: '901' },
        day: 1 as const,
        startMin: 540,
        endMin: 660,
      },
    ];
    expect(replaceOptions([], course, incoming, conflicts)).toEqual([]);
  });

  it('offers nothing for a blocker that clashes by exam only', () => {
    const exam = {
      midterm: { start: '2026-09-01 09:00:00', end: '2026-09-01 12:00:00' },
    };
    const blocker = makeSection({
      teachTableId: 'B',
      subjectId: 'B',
      meetings: [TUESDAY_NINE],
      exam,
    });
    const entries = [entryOf(blocker)];
    const incoming = makeSection({
      teachTableId: 'A',
      subjectId: 'A',
      meetings: [MONDAY_NINE],
      exam,
    });
    const { course, conflicts } = conflictsOf(entries, incoming);
    expect(conflicts.map((conflict) => conflict.kind)).toEqual(['exam']);
    expect(replaceOptions(entries, course, incoming, conflicts)).toEqual([]);
  });
});
