// The plan entries grouped by subject: one group per placed subject, holding its one
// section or the two halves of a pair. The selected courses view, the bottom navigation
// count, and the registration list all read the plan this way, so the order is decided
// once: subjects by id, each subject's sections by section code, both compared
// numerically so a code such as 2 sorts before 12.

import type { PlanEntry } from '../domain/plan';

/** The placed sections of one subject: one section, or the two halves of a pair. */
export interface SubjectGroup {
  subjectId: string;
  entries: PlanEntry[];
}

const byCode = (a: string, b: string): number =>
  a.localeCompare(b, 'en', { numeric: true });

/** Group the plan entries by subject, ordered by subject id, each subject's sections
 * ordered by section code. */
export function groupEntriesBySubject(entries: PlanEntry[]): SubjectGroup[] {
  const groups = new Map<string, PlanEntry[]>();
  for (const entry of entries) {
    const subjectId = entry.snapshot.subjectId;
    groups.set(subjectId, [...(groups.get(subjectId) ?? []), entry]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => byCode(a, b))
    .map(([subjectId, grouped]) => ({
      subjectId,
      entries: [...grouped].sort((a, b) =>
        byCode(a.snapshot.section, b.snapshot.section),
      ),
    }));
}
