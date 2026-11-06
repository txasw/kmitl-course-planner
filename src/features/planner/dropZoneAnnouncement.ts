// The one sentence the feedback strip's live region reads when a drag starts, naming the
// drop targets that drag offers (ADR-0059). Every target appears from activation, so the
// sentence is decided once from the drag kind and its validation, the same result the
// grid paints. The catalog edge rail is not a target, so no sentence names it.

import type { Translate } from '@/lib/i18n/t';
import type { DragStore } from './dragStore';

type DragKinds = Pick<DragStore, 'active' | 'courseDrag' | 'blockMove'>;

/** The drag start sentence for the live drag, or null when no drag is live. */
export function dropZoneAnnouncement(
  drag: DragKinds,
  t: Translate,
): string | null {
  if (drag.active !== null) {
    return drag.active.placement.ok
      ? t('dropZone.addAnnounce')
      : t('dropZone.swapAnnounce');
  }
  if (drag.courseDrag !== null) {
    return t('feedback.courseDropHint');
  }
  if (drag.blockMove !== null) {
    return drag.blockMove.candidates.length > 0
      ? t('dropZone.blockAnnounce')
      : t('dropZone.blockRemoveAnnounce');
  }
  return null;
}
