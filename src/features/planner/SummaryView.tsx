// The summary view of ADR-0049, the plan's detail beside the always visible stats line.
// It opens on the exam schedule, since students share an exam timetable as often as a
// class timetable. A plan with no entries has nothing to summarize, so the view shows a
// designed empty state whose one action brings the catalog into view at its search: the
// catalog pane below 640 px, the sheet on the medium tier, and the docked column on the
// wide tiers. Like the grid, it renders only from the plan snapshots.

import { ClipboardList } from 'lucide-react';
import type { Locale, Translate } from '@/lib/i18n/t';
import type { ExamSchedule } from '@/lib/planner/examSchedule';
import { FOCUS_OUTLINE } from '@/lib/ui/focus';
import { TARGET_SIZE } from '@/lib/ui/target';
import { EmptyState } from '@/components/EmptyState';
import { revealSearch } from '@/features/catalog/revealCourse';
import { useLayoutTier } from '@/features/shell/useLayoutTier';
import { ExamSchedulePanel } from './ExamSchedulePanel';

interface SummaryViewProps {
  schedule: ExamSchedule;
  /** Whether the plan holds any entry; an empty plan shows the empty state. */
  hasEntries: boolean;
  locale: Locale;
  t: Translate;
}

export function SummaryView({
  schedule,
  hasEntries,
  locale,
  t,
}: SummaryViewProps) {
  const tier = useLayoutTier();
  if (!hasEntries) {
    return (
      <EmptyState
        icon={ClipboardList}
        title={t('summary.emptyTitle')}
        description={t('summary.emptyBody')}
        action={
          <button
            type="button"
            onClick={(event) => {
              revealSearch(event.currentTarget, tier);
            }}
            className={`rounded-kcp bg-primary-strong px-3 py-1.5 text-sm font-semibold text-surface hover:bg-primary-hover ${TARGET_SIZE} ${FOCUS_OUTLINE}`}
          >
            {t('summary.goToCourses')}
          </button>
        }
      />
    );
  }
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <ExamSchedulePanel schedule={schedule} locale={locale} t={t} />
    </div>
  );
}
