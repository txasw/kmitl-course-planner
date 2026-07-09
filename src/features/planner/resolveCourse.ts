// Resolve the full course for a placed subject from the latest search result. A
// block move and a swap need the course's sibling sections and pair links, which a
// plan snapshot does not carry, so they look it up here. A null result means the
// subject is not in the current catalog, where a block move degrades to remove only.

import type { Course } from '@/lib/domain/types';
import { findCourseBySubjectId } from '@/lib/catalog/findCourse';
import { searchStore } from '@/features/search/searchStore';

/** The course for a subject from the current catalog, or null when it is not listed. */
export function resolveCourseForSubject(subjectId: string): Course | null {
  const result = searchStore.getState().result;
  if (result.status !== 'ready') {
    return null;
  }
  return findCourseBySubjectId(result.data.courses, subjectId);
}
