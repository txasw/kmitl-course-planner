// The subject id a fill may write into the host field (ADR-0078). Student ids have the
// same eight digit shape as subject ids, so the only id that may reach the field is one
// made here from a subject the plan holds and the kit lists, never from text on the page.

import type { Plan } from '../domain/plan';
import type { RegistrationKit } from './kitSchema';

class PlannedId {
  readonly #brand = true;
  constructor(readonly value: string) {}
  get brand(): boolean {
    return this.#brand;
  }
}

/** A subject id the plan holds and the kit lists, the only kind the field accepts. */
export type PlannedSubjectId = PlannedId;

export function plannedSubjectId(
  subjectId: string,
  plan: Plan,
  kit: RegistrationKit,
): PlannedSubjectId | null {
  if (!/^\d{8}$/.test(subjectId)) return null;
  const planned = plan.entries.some((entry) => entry.subjectId === subjectId);
  const listed = kit.subjects.some((item) => item.subjectId === subjectId);
  return planned && listed ? new PlannedId(subjectId) : null;
}
