// Resolve the full course for a placed subject from the latest search result. A
// block move and a swap need the course's sibling sections and pair links, which a
// plan snapshot does not carry, so they look it up here. A null result means the
// subject is not in the current catalog, or the catalog is showing a different term
// than the active plan, where a block move degrades to remove only rather than
// painting move candidates the transaction would reject as cross term.

import type { Course } from '@/lib/domain/types';
import { asSemester, termsEqual } from '@/lib/routing/academicTerms';
import { findCourseBySubjectId } from '@/lib/catalog/findCourse';
import { searchStore } from '@/features/search/searchStore';
import { planStore } from '@/features/plans/planStore';

/** The course for a subject from the current catalog, or null when it is not listed
 * or the browsed term differs from the active plan's term. */
export function resolveCourseForSubject(subjectId: string): Course | null {
  const search = searchStore.getState();
  if (search.result.status !== 'ready') {
    return null;
  }
  const query = search.resultQuery;
  const plan = planStore.getState();
  const active = plan.plans.find((entry) => entry.id === plan.activePlanId);
  if (query !== null && active !== undefined) {
    const browsedTerm = {
      year: query.selected_year,
      semester: asSemester(query.selected_semester),
    };
    if (
      !termsEqual(browsedTerm, { year: active.year, semester: active.semester })
    ) {
      return null;
    }
  }
  return findCourseBySubjectId(search.result.data.courses, subjectId);
}
