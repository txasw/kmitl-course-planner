// The section group a student chose for this registration, per subject, in place of the
// planned one: the helper's tile, its copy, its add for me, and its clash check use it,
// and the plan changes only when the student saves it there. A choice names the teach
// table ids of one kit option, so it can only point at a group the kit lists. Choices
// are kept per plan and term; a record of another plan or term is never read.
//
// The record once held the student's hand marks under the same key. Such a record still
// validates, with no choices, so the marks drop on read rather than being converted,
// since the status now comes from the page alone.

import { z } from 'zod';
import type { Plan } from '../domain/plan';

export const sectionChoicesSchema = z.object({
  planId: z.string(),
  year: z.string(),
  semester: z.enum(['1', '2', '3']),
  choices: z
    .record(z.string(), z.array(z.string().min(1)).min(1).max(4))
    .default({}),
});
export type SectionChoices = z.infer<typeof sectionChoicesSchema>;

/** Whether choices were saved for this plan in its current term. */
export function choicesBelongTo(
  choices: SectionChoices | null,
  plan: Plan,
): choices is SectionChoices {
  return (
    choices?.planId === plan.id &&
    choices.year === plan.year &&
    choices.semester === plan.semester
  );
}

/** Set or clear one subject's choice, returning new choices for the plan and its term. */
export function withChoice(
  current: SectionChoices | null,
  plan: Plan,
  subjectId: string,
  ids: readonly string[] | null,
): SectionChoices {
  const base: SectionChoices = choicesBelongTo(current, plan)
    ? current
    : {
        planId: plan.id,
        year: plan.year,
        semester: plan.semester,
        choices: {},
      };
  const choices = Object.fromEntries(
    Object.entries(base.choices).filter(([key]) => key !== subjectId),
  );
  if (ids !== null && ids.length > 0) choices[subjectId] = [...ids];
  return { ...base, choices };
}
