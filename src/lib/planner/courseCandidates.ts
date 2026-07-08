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

/** Classify every not yet placed section of the course as a candidate. */
export function courseCandidates(
  course: Course,
  placed: Section[],
): Candidate[] {
  const placedKeys = new Set(placed.map(identity));
  const candidates: Candidate[] = [];
  for (const section of course.sections) {
    if (placedKeys.has(identity(section))) {
      continue; // already on the grid
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
    const placement = checkPlacement(placed, group);
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
