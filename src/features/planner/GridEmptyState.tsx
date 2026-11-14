// The notices centered over a timetable that has nothing to place: the empty plan, shared
// by the edit grid and every preview poster so the empty state reads the same in both,
// and the free day of the day view (ADR-0049). One layout keeps the two alike: a card
// variant of the shared empty state, so the gridlines under it do not cross the text.
// Only the edit grid passes the empty plan its action, which brings the search into
// view; a poster is a picture to share and never carries a control. In portrait the hour
// column runs down the leading edge, sticky over the lanes in edit, so a notice centers
// over the day lanes beside it rather than across it, or the column would cover the
// card's edge and, on a narrow phone, the start of its text.

import { CalendarCheck, CalendarPlus, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Translate } from '@/lib/i18n/t';
import { FOCUS_OUTLINE } from '@/lib/ui/focus';
import { TARGET_SIZE } from '@/lib/ui/target';
import { EmptyState } from '@/components/EmptyState';
import { openSearch } from '@/features/catalog/revealCourse';
import { useLayoutTier } from '@/features/shell/useLayoutTier';
import { PORTRAIT_AXIS_TRACK, type Orientation } from './gridGeometry';

interface GridNoticeProps {
  /** Names the notice in the DOM, so a test finds the one it means. */
  notice: 'empty' | 'free-day';
  icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
  orientation: Orientation;
}

// The wrapper lets pointer events through to the grid, so a drag or a hover over the
// notice still reaches the cells; only the action takes them back.
function GridNotice({
  notice,
  icon,
  title,
  body,
  action,
  orientation,
}: GridNoticeProps) {
  return (
    <div
      data-grid-notice={notice}
      className="pointer-events-none absolute right-0 top-1/2 flex -translate-y-1/2 justify-center px-4"
      style={{ left: orientation === 'portrait' ? PORTRAIT_AXIS_TRACK : 0 }}
    >
      <EmptyState
        variant="card"
        icon={icon}
        title={title}
        description={body}
        action={action}
      />
    </div>
  );
}

function GoToSearchButton({ t }: { t: Translate }) {
  const tier = useLayoutTier();
  return (
    <button
      type="button"
      onClick={(event) => {
        openSearch(event.currentTarget, tier);
      }}
      className={`pointer-events-auto rounded-kcp bg-primary-strong px-3 py-1.5 text-sm font-semibold text-surface hover:bg-primary-hover ${TARGET_SIZE} ${FOCUS_OUTLINE}`}
    >
      {t('grid.goToSearch')}
    </button>
  );
}

interface GridEmptyStateProps {
  t: Translate;
  /** The grid's orientation, so the notice clears a portrait hour column. */
  orientation: Orientation;
  /** Whether to offer the action that brings the search into view; the edit grid only. */
  searchAction?: boolean;
}

export function GridEmptyState({
  t,
  orientation,
  searchAction = false,
}: GridEmptyStateProps) {
  return (
    <GridNotice
      notice="empty"
      orientation={orientation}
      icon={CalendarPlus}
      title={t('grid.emptyTitle')}
      body={t('grid.emptyBody')}
      action={searchAction ? <GoToSearchButton t={t} /> : undefined}
    />
  );
}

/** The day view's note for a shown day with no class, titled with the day's name. */
export function FreeDayNotice({
  dayName,
  t,
}: {
  dayName: string;
  t: Translate;
}) {
  return (
    <GridNotice
      notice="free-day"
      orientation="portrait"
      icon={CalendarCheck}
      title={dayName}
      body={t('view.freeDay')}
    />
  );
}
