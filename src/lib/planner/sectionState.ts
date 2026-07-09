// Classify a catalog section against the sections already placed in the plan, so
// the catalog can render one of four states per section. The plan is empty in
// this phase, so every open section is addable; the added, conflicting, and
// duplicate branches are exercised by tests and become live when Phase 5 fills
// the plan store. The classification is a thin composition of the existing
// placement engine and duplicate rule, kept pure and framework free.

import type { Course, Section } from '../domain/types';
import { termsEqual, type Term } from '../routing/academicTerms';
import type { ConflictDetail } from './placement';
import { checkPlacement, expandSectionGroup } from './placement';

export type SectionRelation =
  | { kind: 'added' }
  | { kind: 'addable' }
  | { kind: 'duplicate'; subjectId: string }
  | { kind: 'conflicting'; conflicts: ConflictDetail[] }
  | { kind: 'different_term'; planTerm: Term; browsedTerm: Term };

/** The active plan's term and the term the catalog is showing, for the different
 * term check. Either side is null when there is no active plan or no result yet. */
export interface TermContext {
  planTerm: Term | null;
  browsedTerm: Term | null;
}

function isPlaced(placed: Section[], section: Section): boolean {
  return placed.some(
    (entry) =>
      entry.subjectId === section.subjectId &&
      entry.section === section.section,
  );
}

/**
 * Classify a section relative to the placed sections. A section browsed in a term
 * other than the active plan's is different_term, checked first because such a
 * section belongs to no comparison with the plan and is not addable to it. Otherwise
 * it is added when already in the plan by durable identity, then, for an unplaced
 * section, addable when its atomic group places cleanly, duplicate when it repeats an
 * existing subject, or conflicting when it overlaps an existing meeting in time.
 */
export function computeSectionRelation(
  placed: Section[],
  course: Course,
  section: Section,
  term?: TermContext,
): SectionRelation {
  if (
    term?.planTerm != null &&
    term.browsedTerm != null &&
    !termsEqual(term.planTerm, term.browsedTerm)
  ) {
    return {
      kind: 'different_term',
      planTerm: term.planTerm,
      browsedTerm: term.browsedTerm,
    };
  }
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
