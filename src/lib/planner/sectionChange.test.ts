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
import { changeOptions, replaceOptions } from './sectionChange';

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

describe('changeOptions', () => {
  it('lists each other open group once, soonest first, against the plan without the current one', () => {
    const current = makeSection({
      teachTableId: 'A1',
      subjectId: 'A',
      section: '1',
      pairedSection: '101',
      meetings: [MONDAY_NINE],
    });
    const currentPractice = makeSection({
      teachTableId: 'A101',
      subjectId: 'A',
      section: '101',
      pairedSection: '1',
      meetings: [WEDNESDAY_NINE],
    });
    // Group 2 sits where the current group does, which is free once it leaves.
    const second = makeSection({
      teachTableId: 'A2',
      subjectId: 'A',
      section: '2',
      pairedSection: '102',
      meetings: [WEDNESDAY_NINE],
    });
    const secondPractice = makeSection({
      teachTableId: 'A102',
      subjectId: 'A',
      section: '102',
      pairedSection: '2',
      meetings: [MONDAY_NINE],
    });
    const early = makeSection({
      teachTableId: 'A3',
      subjectId: 'A',
      section: '3',
      meetings: [makeMeeting({ day: 1, startMin: 420, endMin: 480 })],
    });
    const course = makeCourse({
      subjectId: 'A',
      sections: [current, second, early, currentPractice, secondPractice],
    });
    const entries = [entryOf(current), entryOf(currentPractice)];
    const options = changeOptions(entries, course, 'A101');
    expect(
      options.map((option) => option.group.map((member) => member.section)),
    ).toEqual([['3'], ['2', '102']]);
  });

  it('leaves out a group that clashes with another subject or is full', () => {
    const current = makeSection({
      teachTableId: 'A1',
      subjectId: 'A',
      section: '1',
      meetings: [MONDAY_NINE],
    });
    const clashing = makeSection({
      teachTableId: 'A2',
      subjectId: 'A',
      section: '2',
      meetings: [TUESDAY_NINE],
    });
    const full = makeSection({
      teachTableId: 'A3',
      subjectId: 'A',
      section: '3',
      meetings: [WEDNESDAY_NINE],
      seats: { limit: 40, preCount: 0, queueLeft: 0, enrolled: 'full' },
    });
    const other = makeSection({
      teachTableId: 'B',
      subjectId: 'B',
      meetings: [TUESDAY_NINE],
    });
    const course = makeCourse({
      subjectId: 'A',
      sections: [current, clashing, full],
    });
    expect(
      changeOptions([entryOf(current), entryOf(other)], course, 'A1'),
    ).toEqual([]);
  });

  it('matches the placed group by section code when its id moved', () => {
    const placed = makeSection({ teachTableId: 'old', subjectId: 'A' });
    const listed = makeSection({ teachTableId: 'new', subjectId: 'A' });
    const course = makeCourse({ subjectId: 'A', sections: [listed] });
    expect(changeOptions([entryOf(placed)], course, 'old')).toEqual([]);
  });

  it('lists nothing for an entry the plan does not hold', () => {
    expect(changeOptions([], makeCourse(), 'gone')).toEqual([]);
  });
});
