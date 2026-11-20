// The notices over a timetable that has nothing to place: the empty plan, shared by the
// edit grid and every preview poster so the empty state reads the same in both, and the
// free day of the day view (ADR-0049). Both are the shared empty state the catalog and the
// summary use, a neutral icon disc, a title, one sentence, and one action, with no surface of their
// own: no border, no radius, no shadow, and no tinted disc, so nothing floats over the
// gridlines as a separate object. The notice instead washes the grid body it stands in for
// with the surface color, which knocks the lanes and rules back far enough that no rule
// crosses the text at full strength, while the axes stay crisp and the grid still reads as
// the empty grid. Only the edit grid passes the empty plan its action, which brings the
// search into view; a poster is a picture to share and never carries a control. The grid
// renders the notice as one of its own items over the grid body, so it centers on the day
// rows and the time tracks rather than on the scroller around them: a landscape week packs
// its rows to the top of a taller scroller, where a notice centered on the scroller would
// sit low or below the rows. Spanning the body also keeps the notice clear of the leading
// axis, the day column in landscape and the hour column in portrait, both sticky over the
// lanes in edit, which would otherwise cover the start of its text on a narrow phone. Where
// the body runs taller than the scroller, as the phone's day view does, the text sticks
// inside the visible part, below the sticky axis row, so a short screen never leaves it
// below the fold.
//
// The notice yields to the drag feedback. It paints as a positioned item over the body, so
// it would cover the footprint ghosts, which are not positioned, and cross the candidate
// slots and the commit zone, which are. While the grid paints feedback the notice is
// hidden but keeps its box, so the day rows it spans never resize under the pointer, and
// it returns when the drag ends, is cancelled, or the preview clears.

import { CalendarCheck, CalendarPlus, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useStore } from 'zustand';
import type { Translate } from '@/lib/i18n/t';
import { EmptyState, EmptyStateAction } from '@/components/EmptyState';
import { openSearch } from '@/features/catalog/revealCourse';
import { useLayoutTier } from '@/features/shell/useLayoutTier';
import { dragStore, selectGridFeedback } from './dragStore';
import { AXIS_TRACK_EM, GRID_BODY_PLACEMENT } from './gridGeometry';

// The sticky edges of the text, in em of the grid font it inherits: the axis row above,
// and the scroller's foot below.
const STICKY_EDGES = { top: `${String(AXIS_TRACK_EM)}em`, bottom: 0 } as const;

interface GridNoticeProps {
  /** Names the notice in the DOM, so a test finds the one it means. */
  notice: 'empty' | 'free-day';
  icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
}

// The wrapper lets pointer events through to the grid, so a drag or a hover over the
// notice still reaches the cells; only the action takes them back.
function GridNotice({ notice, icon, title, body, action }: GridNoticeProps) {
  const yielding = useStore(dragStore, selectGridFeedback);
  return (
    <div
      data-grid-notice={notice}
      className="pointer-events-none relative flex min-h-0 min-w-0 items-center justify-center bg-surface/80 px-4"
      style={
        yielding
          ? { ...GRID_BODY_PLACEMENT, visibility: 'hidden' }
          : GRID_BODY_PLACEMENT
      }
    >
      <div className="sticky" style={STICKY_EDGES}>
        <EmptyState
          icon={icon}
          title={title}
          description={body}
          action={action}
        />
      </div>
    </div>
  );
}

function GoToSearchButton({ t }: { t: Translate }) {
  const tier = useLayoutTier();
  return (
    <EmptyStateAction
      label={t('grid.goToSearch')}
      onClick={(event) => {
        openSearch(event.currentTarget, tier);
      }}
    />
  );
}

interface GridEmptyStateProps {
  t: Translate;
  /** Whether to offer the action that brings the search into view; the edit grid only. */
  searchAction?: boolean;
}

export function GridEmptyState({
  t,
  searchAction = false,
}: GridEmptyStateProps) {
  return (
    <GridNotice
      notice="empty"
      icon={CalendarPlus}
      title={t('grid.emptyTitle')}
      body={t('grid.emptyBody')}
      action={searchAction ? <GoToSearchButton t={t} /> : undefined}
    />
  );
}

/** The day view's note for a shown day with no class, titled with the day's name. Its
 * action returns to the week, the view that shows the classes of the other days. */
export function FreeDayNotice({
  dayName,
  onShowWeek,
  t,
}: {
  dayName: string;
  onShowWeek: (control: HTMLElement) => void;
  t: Translate;
}) {
  return (
    <GridNotice
      notice="free-day"
      icon={CalendarCheck}
      title={dayName}
      body={t('view.freeDay')}
      action={
        <EmptyStateAction
          label={t('view.showWeek')}
          onClick={(event) => {
            onShowWeek(event.currentTarget);
          }}
        />
      }
    />
  );
}
