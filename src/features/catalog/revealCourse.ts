// Shows one course in the catalog, for the feedback strip's show in the list action. It
// narrows the list to the subject id, opens that card even if the student closed it
// before, brings the catalog into view, the docked column on the wide tiers, the sheet
// on the medium tier, and the catalog pane below 640 px, then scrolls the card into
// view and moves focus to its toggle. Without the last steps the action changed a list
// the student could not see. It is a no op while a drag is in flight, and reports
// whether it ran, so the caller clears the notice only when the catalog took over.

import { flushSync } from 'react-dom';
import { catalogQueryKey } from '@/lib/catalog/cardDisclosure';
import type { LayoutTier } from '@/lib/ui/breakpoints';
import { planStore } from '@/features/plans/planStore';
import { dragStore, selectDragging } from '@/features/planner/dragStore';
import { searchStore } from '@/features/search/searchStore';
import { revealCatalog } from '@/features/shell/catalogVisibility';
import { rootOf } from '@/features/shell/useFocusTrap';
import { REDUCED_MOTION_QUERY } from '@/features/shell/usePresence';
import { catalogStore } from './catalogStore';
import { courseToggleId } from './courseFocus';
import { revealCard } from './useRevealOnExpand';

export function revealCourse(
  control: Element,
  subjectId: string,
  tier: LayoutTier,
): boolean {
  if (selectDragging(dragStore.getState())) return false;
  const root = rootOf(control);
  // The choice carries the course's placement, since a rejected block move reveals a
  // course already in the plan and a choice tagged unadded would not open its card.
  const added = planStore
    .getState()
    .entries.some((entry) => entry.subjectId === subjectId);
  flushSync(() => {
    const catalog = catalogStore.getState();
    catalog.setText(subjectId);
    catalog.setCardOpen(
      catalogQueryKey(searchStore.getState().resultQuery),
      subjectId,
      { open: true, added },
    );
  });
  const focusId = courseToggleId(subjectId);
  revealCatalog(control, tier, focusId);
  const card = root?.getElementById(focusId)?.closest('[data-course-card]');
  if (card instanceof HTMLElement) {
    revealCard(card, window.matchMedia(REDUCED_MOTION_QUERY).matches);
  }
  return true;
}
