// The notices centered over a timetable that has nothing to place: the empty plan, shared
// by the edit grid and every preview poster so the empty state reads the same in both,
// and the free day of the day view (ADR-0049). One layout keeps the two alike.

import { CalendarCheck, CalendarPlus, type LucideIcon } from 'lucide-react';
import type { Translate } from '@/lib/i18n/t';

interface GridNoticeProps {
  /** Names the notice in the DOM, so a test finds the one it means. */
  notice: 'empty' | 'free-day';
  icon: LucideIcon;
  title: string;
  body: string;
}

function GridNotice({ notice, icon: Icon, title, body }: GridNoticeProps) {
  return (
    <div
      data-grid-notice={notice}
      className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 flex-col items-center gap-2 px-6 text-center"
    >
      <Icon
        size={28}
        strokeWidth={1.75}
        className="text-ink-soft"
        aria-hidden
      />
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="text-sm text-ink-soft">{body}</p>
    </div>
  );
}

export function GridEmptyState({ t }: { t: Translate }) {
  return (
    <GridNotice
      notice="empty"
      icon={CalendarPlus}
      title={t('grid.emptyTitle')}
      body={t('grid.emptyBody')}
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
      icon={CalendarCheck}
      title={dayName}
      body={t('view.freeDay')}
    />
  );
}
