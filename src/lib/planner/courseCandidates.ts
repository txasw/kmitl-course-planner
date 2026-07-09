// Candidates for a course level drag: every section of the course classified as a
// droppable slot or a blocked one, so the grid can show the whole picture at once.
// A section is droppable when it is not already placed, its seat is open, and its
// group fits; otherwise it is blocked, tagged with why, a full or closed seat, a
// duplicate subject, or a time conflict, including full and closed sections so the
// picture is complete. This pure engine feeds the grid candidate overlay.

import type { Course, Section } from '../domain/types';
import { computeSeatStatus } from '../catalog/seatStatus';
import { checkPlacement, expandSectionGroup } from './placement';

export type CandidateReason =
  'ok' | 'conflict' | 'duplicate' | 'full' | 'closed';

export interface Candidate {
  section: Section;
  /** The section and its declared pair, placed atomically. */
  group: Section[];
  valid: boolean;
  reason: CandidateReason;
}

function identity(section: Section): string {
  return `${section.subjectId}:${section.section}`;
}

/**
 * Classify every not yet placed section of the course as a candidate. The exclude
 * set holds durable identities (subjectId:section) to leave out of both the conflict
 * baseline and the emitted candidates, which is how a block move treats the dragged
 * section and its pair as already gone so the subject's other sections read as free.
 */
export function courseCandidates(
  course: Course,
  placed: Section[],
  exclude = new Set<string>(),
): Candidate[] {
  const baseline = placed.filter((section) => !exclude.has(identity(section)));
  const placedKeys = new Set(baseline.map(identity));
  const candidates: Candidate[] = [];
  for (const section of course.sections) {
    if (placedKeys.has(identity(section)) || exclude.has(identity(section))) {
      continue; // already on the grid, or the block being moved
    }
    const group = expandSectionGroup(course, section);
    const seat = computeSeatStatus(section);
    if (seat.kind === 'closed') {
      candidates.push({ section, group, valid: false, reason: 'closed' });
      continue;
    }
    if (seat.kind === 'full') {
      candidates.push({ section, group, valid: false, reason: 'full' });
      continue;
    }
    const placement = checkPlacement(baseline, group);
    if (placement.ok) {
      candidates.push({ section, group, valid: true, reason: 'ok' });
      continue;
    }
    const duplicate = placement.conflicts.some(
      (conflict) => conflict.kind === 'duplicate',
    );
    candidates.push({
      section,
      group,
      valid: false,
      reason: duplicate ? 'duplicate' : 'conflict',
    });
  }
  return candidates;
}
