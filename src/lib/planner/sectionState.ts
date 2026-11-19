// Classify a catalog section against the sections placed in the active plan, so
// the catalog card, the catalog filters, and the section comparison all read one
// of five states per section: different term, added, addable, duplicate subject,
// or conflicting. Conflicting covers both a time clash and an exam overlap, since
// both come from checkPlacement. Seat state is not part of the relation; full and
// closed sections are gated separately by the seat status. The classification is a
// thin composition of the placement engine and the term check, kept pure and
// framework free.

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
 * existing subject, or conflicting when it clashes with a placed meeting or exam.
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
