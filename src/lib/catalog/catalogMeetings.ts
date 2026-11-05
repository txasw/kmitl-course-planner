// The meetings of every section in a catalog result, for the edit grid window. The set
// reads the normalized result, not the filtered list, so a client side filter never
// reflows the grid, and an idle, loading, or failed search contributes nothing.

import type { NormalizedCatalog } from '../domain/normalize';
import type { Meeting } from '../domain/types';
import type { AsyncState } from '../utils/async';

/** Every meeting of every section in a ready catalog result, or none. */
export function catalogMeetings(
  result: AsyncState<NormalizedCatalog>,
): Meeting[] {
  if (result.status !== 'ready') {
    return [];
  }
  return result.data.courses.flatMap((course) =>
    course.sections.flatMap((section) => section.meetings),
  );
}
