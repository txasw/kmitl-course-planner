// Shows one course in the catalog, for the feedback strip's show in the list action. It
// narrows the list to the subject id, opens that card even if the student closed it
// before, brings the catalog into view, the docked column on the wide tiers, the sheet
// on the medium tier, and the catalog pane below 640 px, then scrolls the card into
// view and moves focus to its toggle. Without the last steps the action changed a list
// the student could not see. When the subject is no longer in the result, a by subject
// id search for it runs instead, in the active plan's term, and focus lands on the
// summary bar the search adds. Both are no ops while a drag is in flight, and each
// reports whether it ran, so the caller clears the notice only when the catalog took
// over. Below 640 px an open search form fills the catalog pane over hidden, inert
// results, so the reveal folds it first, or the card it opens could take neither the
// view nor the focus.

import { flushSync } from 'react-dom';
import { catalogQueryKey } from '@/lib/catalog/cardDisclosure';
import type { LayoutTier } from '@/lib/ui/breakpoints';
import { activePlanTerm, planStore } from '@/features/plans/planStore';
import { dragStore, selectDragging } from '@/features/planner/dragStore';
import { SEARCH_BAR_ID } from '@/features/search/searchIds';
import { searchStore } from '@/features/search/searchStore';
import { revealCatalog } from '@/features/shell/catalogVisibility';
import { commitAndFocus } from '@/features/shell/commitAndFocus';
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
    if (tier === 'compact') {
      searchStore.getState().setSearchFormOpen(false);
    }
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

export function searchForCourse(
  control: Element,
  subjectId: string,
  tier: LayoutTier,
  submit: () => Promise<void>,
): boolean {
  if (selectDragging(dragStore.getState())) return false;
  revealCatalog(control, tier, SEARCH_BAR_ID);
  // Every entry a blocked notice names belongs to the active plan's term.
  const term = activePlanTerm();
  // The submit writes the bar before its first await, so the bar exists once the commit
  // returns and takes focus from the action that started the search.
  commitAndFocus(control, SEARCH_BAR_ID, () => {
    const search = searchStore.getState();
    search.setActiveTab('by_subject_id');
    search.patchSubjectIdForm({ subjectId });
    if (term !== null) {
      search.patchTerm(term);
    }
    catalogStore.getState().setText(subjectId);
    void submit();
  });
  return true;
}
