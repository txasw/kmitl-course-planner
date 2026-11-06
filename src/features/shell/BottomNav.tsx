// The bottom nav of the compact tier of ADR-0048 and ADR-0049: one item for the catalog
// pane and one per plan view, so below 640 px one pane shows at a time. It is a nav
// landmark of plain buttons, and the item on screen carries aria-current, because the
// items switch panes rather than tabbing a panel in place. Pressing an item keeps focus
// on it, since the nav sits outside both panes, which turn inert in turn. The catalog item
// carries the result course count and the selected item the placed subject count, each
// as a chip over the icon and in the accessible name, so the number is read with the
// label. While the plan has anything to review, the timetable item carries the review dot
// of ADR-0060, and its accessible name adds the updates indicator wording with the count,
// so the dot's meaning is not carried by colour alone. The indicator chip itself heads the
// plan pane. Each item is at least 56 px tall, and the nav pads below them by the bottom
// safe area inset, so the items stay clear of the home indicator while the fill reaches it.
// During a block drag the nav turns into the remove bar: its items hide and go inert, and
// the bar lays over the nav's own box, so the pane above keeps its height mid drag and a
// lift over the bar never reaches a nav item, which has no meaning while a block is held.
// Preview has no nav, because Layout returns before it for the poster.

import { useStore } from 'zustand';
import {
  CalendarDays,
  ListChecks,
  Search,
  type LucideIcon,
} from 'lucide-react';
import { CountChip } from '@/components/CountChip';
import { useResultCourseCount } from '@/features/catalog/CatalogPanel';
import { NavRemoveBar, useNavRemoving } from '@/features/planner/RemoveZone';
import { groupEntriesBySubject } from '@/features/planner/SelectedCoursesList';
import { planStore } from '@/features/plans/planStore';
import type { Translate, TranslationKey } from '@/lib/i18n/t';
import { fillTemplate } from '@/lib/i18n/template';
import { countUpdateItems } from '@/lib/planner/updateReview';
import { FOCUS_RING } from '@/lib/ui/focus';
import {
  NAV_ITEMS,
  activeNavItem,
  navItemId,
  selectNavItem,
  useMobilePane,
  type NavItem,
} from './mobilePane';
import { uiStore } from './uiStore';
import { useTranslation } from './useTranslation';

const LABEL_KEY: Record<NavItem, TranslationKey> = {
  catalog: 'catalog.open',
  timetable: 'planView.timetable',
  selected: 'nav.selected',
};

const ICON: Record<NavItem, LucideIcon> = {
  catalog: Search,
  timetable: CalendarDays,
  selected: ListChecks,
};

/** The count an item shows, or null for none. A plan with no subjects shows no zero. */
function itemCount(
  item: NavItem,
  courseCount: number | null,
  selectedCount: number,
): number | null {
  if (item === 'catalog') return courseCount;
  if (item === 'selected') return selectedCount > 0 ? selectedCount : null;
  return null;
}

/** The accessible name of an item: its label, then its count and its review wording. */
function itemName(
  label: string,
  count: number | null,
  reviewCount: number,
  t: Translate,
): string {
  return [
    label,
    count === null ? null : String(count),
    reviewCount > 0
      ? fillTemplate(t('updates.indicator'), { count: reviewCount })
      : null,
  ]
    .filter((part) => part !== null)
    .join(' ');
}

export function BottomNav() {
  const { t } = useTranslation();
  const pane = useMobilePane();
  const planView = useStore(uiStore, (state) => state.planView);
  const courseCount = useResultCourseCount();
  const selectedCount = useStore(
    planStore,
    (state) => groupEntriesBySubject(state.entries).length,
  );
  const reviewCount = useStore(planStore, (state) =>
    countUpdateItems(state.entries),
  );
  const active = activeNavItem(pane, planView);
  const removing = useNavRemoving();

  return (
    <nav
      aria-label={t('nav.label')}
      className="relative flex shrink-0 border-t border-border bg-surface pb-(--kcp-safe-bottom)"
    >
      <div
        inert={removing || undefined}
        className={`flex min-w-0 flex-1 ${removing ? 'invisible' : ''}`}
      >
        {NAV_ITEMS.map((item) => {
          const Icon = ICON[item];
          const label = t(LABEL_KEY[item]);
          const count = itemCount(item, courseCount, selectedCount);
          const itemReviews = item === 'timetable' ? reviewCount : 0;
          const current = item === active;
          return (
            <button
              key={item}
              id={navItemId(item)}
              type="button"
              aria-current={current ? 'page' : undefined}
              aria-label={itemName(label, count, itemReviews, t)}
              onClick={() => {
                selectNavItem(item);
              }}
              className={`-mt-px flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 border-t-2 px-1 text-xs transition-colors motion-reduce:transition-none ${FOCUS_RING} ${
                current
                  ? 'border-primary font-semibold text-primary-strong'
                  : 'border-transparent text-ink-soft hover:text-ink'
              }`}
            >
              <span className="relative flex">
                <Icon size={20} strokeWidth={2} aria-hidden />
                {count === null ? null : (
                  <span className="absolute -top-2 left-3.5">
                    <CountChip count={count} />
                  </span>
                )}
                {itemReviews > 0 ? (
                  <span
                    data-review-dot
                    className="absolute -top-0.5 -right-1 size-2.5 rounded-full bg-warn ring-2 ring-surface"
                  />
                ) : null}
              </span>
              <span className="max-w-full truncate">{label}</span>
            </button>
          );
        })}
      </div>
      {removing ? <NavRemoveBar /> : null}
    </nav>
  );
}
