// The notices over a timetable that has nothing to place: the empty plan, shared by the
// edit grid and every preview poster so the empty state reads the same in both, and the
// free day of the day view (ADR-0049).
//
// The empty plan is the shared empty state the catalog and the summary use, a neutral icon
// disc, a title, one sentence, and one action, with no surface of its own: no border, no
// radius, no shadow, and no tinted disc, so nothing floats over the gridlines as a separate
// object. The notice instead washes the grid body it stands in for with the surface color,
// which knocks the lanes and rules back far enough that no rule crosses the text at full
// strength, while the axes stay crisp and the grid still reads as the empty grid. Only the
// edit grid passes the empty plan its action, which brings the search into view; a poster
// is a picture to share and never carries a control. The grid renders the notice as one of
// its own items over the grid body, so it centers on the day rows and the time tracks
// rather than on the scroller around them: a landscape week packs its rows to the top of a
// taller scroller, where a notice centered on the scroller would sit low or below the rows.
// Spanning the body also keeps the notice clear of the leading axis, the day column in
// landscape and the hour column in portrait, both sticky over the lanes in edit, which
// would otherwise cover the start of its text on a narrow phone. Where the body runs taller
// than the scroller, as the phone's day view does, the text sticks inside the visible part,
// below the sticky axis row, so a short screen never leaves it below the fold.
//
// The free day is quieter, as the mockup draws it: one line at the top edge of the day
// slot, a small glyph, one sentence, and a text button back to the week, with no frame, no
// disc, and no wash over the lanes. It does not repeat the day name, which the chip row and
// the grid label already carry, and it does not stick, since a free day opens at the top.
//
// Both notices yield to the drag feedback. Each paints as a positioned item over the body,
// so it would cover the footprint ghosts, which are not positioned, and cross the candidate
// slots and the commit zone, which are. While the grid paints feedback the notice is hidden
// but keeps its box, so the day rows it spans never resize under the pointer, and it
// returns when the drag ends, is cancelled, or the preview clears.

import { CalendarCheck, CalendarPlus } from 'lucide-react';
import type { CSSProperties } from 'react';
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

/** The notice's place over the grid body, hidden while the grid paints drag feedback. */
function useNoticePlacement(): CSSProperties {
  const yielding = useStore(dragStore, selectGridFeedback);
  return yielding
    ? { ...GRID_BODY_PLACEMENT, visibility: 'hidden' }
    : GRID_BODY_PLACEMENT;
}

function GoToSearchButton({ t }: { t: Translate }) {
  const tier = useLayoutTier();
  return (
    <EmptyStateAction
      label={t('grid.goToSearch')}
      variant="ghost"
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

// The wrapper lets pointer events through to the grid, so a drag or a hover over the
// notice still reaches the cells; only the action takes them back.
export function GridEmptyState({
  t,
  searchAction = false,
}: GridEmptyStateProps) {
  return (
    <div
      data-grid-notice="empty"
      className="pointer-events-none relative flex min-h-0 min-w-0 items-center justify-center bg-surface/80 px-4"
      style={useNoticePlacement()}
    >
      <div className="sticky" style={STICKY_EDGES}>
        <EmptyState
          icon={CalendarPlus}
          title={t('grid.emptyTitle')}
          description={t('grid.emptyBody')}
          action={searchAction ? <GoToSearchButton t={t} /> : undefined}
        />
      </div>
    </div>
  );
}

/** The day view's one line for a shown day with no class. Its action returns to the
 * week, the view that shows the classes of the other days. The line alone takes the
 * surface color, so no quarter rule crosses its text while the lanes below stay as they
 * are. */
export function FreeDayNotice({
  onShowWeek,
  t,
}: {
  onShowWeek: (control: HTMLElement) => void;
  t: Translate;
}) {
  return (
    <div
      data-grid-notice="free-day"
      className="pointer-events-none relative flex min-h-0 min-w-0 flex-col"
      style={useNoticePlacement()}
    >
      <p className="flex flex-wrap items-center gap-x-2 bg-surface px-3 py-1 text-sm text-ink-soft">
        <CalendarCheck size={16} strokeWidth={1.75} aria-hidden />
        <span>{t('view.freeDay')}</span>
        <EmptyStateAction
          label={t('view.showWeek')}
          variant="ghost"
          onClick={(event) => {
            onShowWeek(event.currentTarget);
          }}
        />
      </p>
    </div>
  );
}
