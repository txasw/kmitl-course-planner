// Time overlaps among the sections placed in a plan, keyed by teachTableId, so the
// grid can flag a block that a revalidation time change put into conflict. It reports
// only time overlaps and never a duplicate subject, because a settled plan already
// holds lecture and practice pairs of one subject, and a conflict a time change
// creates is always an overlap. Declared pair members never conflict with each other.

import type { Meeting, Section } from '../domain/types';
import { areDeclaredPair, meetingsOverlap } from './conflicts';
import type { ConflictDetail } from './placement';

function ref(section: Section) {
  return {
    teachTableId: section.teachTableId,
    subjectId: section.subjectId,
    section: section.section,
  };
}

function timeDetail(blocking: Section, meeting: Meeting): ConflictDetail {
  return {
    kind: 'time',
    blocking: ref(blocking),
    day: meeting.day,
    startMin: meeting.startMin,
    endMin: meeting.endMin,
  };
}

/** The time conflicts each placed section has, keyed by teachTableId. A section with
 * no conflict is absent from the map. */
export function planConflicts(
  sections: Section[],
): Map<string, ConflictDetail[]> {
  const conflicts = new Map<string, ConflictDetail[]>();
  const add = (id: string, detail: ConflictDetail): void => {
    const list = conflicts.get(id);
    if (list === undefined) {
      conflicts.set(id, [detail]);
    } else {
      list.push(detail);
    }
  };
  for (let i = 0; i < sections.length; i += 1) {
    for (let j = i + 1; j < sections.length; j += 1) {
      const a = sections[i];
      const b = sections[j];
      if (a === undefined || b === undefined || areDeclaredPair(a, b)) {
        continue;
      }
      for (const ma of a.meetings) {
        for (const mb of b.meetings) {
          if (ma.day === mb.day && meetingsOverlap(ma, mb)) {
            add(a.teachTableId, timeDetail(b, mb));
            add(b.teachTableId, timeDetail(a, ma));
          }
        }
      }
    }
  }
  return conflicts;
}
