// Shows one course in the catalog, for the feedback strip's show in the list action.
// It narrows the list to the subject id, opens that card even if the student closed
// it before, and brings the catalog into view: the docked column on the wide tiers,
// the sheet on the medium tier, and the catalog pane below 640 px. Without the last step
// the action changed a list the student could not see.

import { catalogQueryKey } from '@/lib/catalog/cardDisclosure';
import { isDockedTier, type LayoutTier } from '@/lib/ui/breakpoints';
import { planStore } from '@/features/plans/planStore';
import { searchStore } from '@/features/search/searchStore';
import { selectNavItem } from '@/features/shell/mobilePane';
import { uiStore } from '@/features/shell/uiStore';
import { catalogStore } from './catalogStore';

export function revealCourse(subjectId: string, tier: LayoutTier): void {
  const catalog = catalogStore.getState();
  catalog.setText(subjectId);
  // The choice carries the course's placement, since a rejected block move reveals a
  // course already in the plan and a choice tagged unadded would not open its card.
  const added = planStore
    .getState()
    .entries.some((entry) => entry.subjectId === subjectId);
  catalog.setCardOpen(
    catalogQueryKey(searchStore.getState().resultQuery),
    subjectId,
    { open: true, added },
  );
  if (isDockedTier(tier)) {
    uiStore.getState().setCatalogVisible(true);
  } else if (tier === 'medium') {
    uiStore.getState().setSheetOpen(true);
  } else {
    selectNavItem('catalog');
  }
}
