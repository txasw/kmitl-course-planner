// Classify a catalog section against the sections already placed in the plan, so
// the catalog can render one of four states per section. The plan is empty in
// this phase, so every open section is addable; the added, conflicting, and
// duplicate branches are exercised by tests and become live when Phase 5 fills
// the plan store. The classification is a thin composition of the existing
// placement engine and duplicate rule, kept pure and framework free.

import type { Course, Section } from '../domain/types';
import type { ConflictDetail } from './placement';
import { checkPlacement, expandSectionGroup } from './placement';

export type SectionRelation =
  | { kind: 'added' }
  | { kind: 'addable' }
  | { kind: 'duplicate'; subjectId: string }
  | { kind: 'conflicting'; conflicts: ConflictDetail[] };

function isPlaced(placed: Section[], section: Section): boolean {
  return placed.some(
    (entry) =>
      entry.subjectId === section.subjectId &&
      entry.section === section.section,
  );
}

/**
 * Classify a section relative to the placed sections: added when it is already
 * in the plan by durable identity, then, for an unplaced section, addable when
 * its atomic group places cleanly, duplicate when it repeats an existing
 * subject, or conflicting when it overlaps an existing meeting in time.
 */
export function computeSectionRelation(
  placed: Section[],
  course: Course,
  section: Section,
): SectionRelation {
  if (isPlaced(placed, section)) {
    return { kind: 'added' };
  }
  const result = checkPlacement(placed, expandSectionGroup(course, section));
  if (result.ok) {
    return { kind: 'addable' };
  }
  const duplicate = result.conflicts.find(
    (conflict) => conflict.kind === 'duplicate',
  );
  if (duplicate !== undefined) {
    return { kind: 'duplicate', subjectId: duplicate.subjectId };
  }
  return { kind: 'conflicting', conflicts: result.conflicts };
}
