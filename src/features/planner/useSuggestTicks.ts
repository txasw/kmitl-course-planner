// The tick list state of the suggestion dialog. The result's courses keep the ticks the
// student gave them, the curriculum subjects ticked by default. A subject already in the
// plan is held the other way round, by whether the student unticked it, so a subject the
// plan gains while the dialog is open joins the list ticked, as every plan subject does,
// rather than being left out of the suggestions without the student's choice.

import { useMemo, useState } from 'react';
import type { PlanEntry } from '@/lib/domain/plan';
import type { Course } from '@/lib/domain/types';
import {
  defaultSuggestSubjects,
  suggestableCourses,
  type SuggestSubjectGroups,
} from '@/lib/planner/suggestSubjects';

export interface SuggestTicks {
  groups: SuggestSubjectGroups;
  /** The ticked subject ids across every group. */
  ticked: ReadonlySet<string>;
  setTicked: (next: ReadonlySet<string>) => void;
}

interface TickState {
  /** The ticks the student gave, read only for the result's courses outside the plan. */
  picked: ReadonlySet<string>;
  /** The plan subjects the student unticked. */
  unticked: ReadonlySet<string>;
}

export function useSuggestTicks(
  courses: readonly Course[],
  entries: readonly PlanEntry[],
): SuggestTicks {
  const groups = useMemo(
    () => suggestableCourses(courses, entries),
    [courses, entries],
  );
  const planned = useMemo(
    () => groups.planned.map((course) => course.subjectId),
    [groups],
  );
  const [state, setState] = useState<TickState>(() => ({
    picked: defaultSuggestSubjects(courses, entries),
    unticked: new Set(),
  }));
  const ticked = useMemo(() => {
    const inPlan = new Set(planned);
    return new Set([
      ...[...state.picked].filter((subjectId) => !inPlan.has(subjectId)),
      ...planned.filter((subjectId) => !state.unticked.has(subjectId)),
    ]);
  }, [planned, state]);
  const setTicked = (next: ReadonlySet<string>) => {
    setState({
      picked: next,
      unticked: new Set(planned.filter((subjectId) => !next.has(subjectId))),
    });
  };
  return { groups, ticked, setTicked };
}
