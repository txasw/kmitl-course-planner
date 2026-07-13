// The empty timetable message, centered over the grid when the plan has no scheduled
// sections. Shared by the edit grid and every preview poster so the empty state reads the
// same in both.

import { CalendarPlus } from 'lucide-react';
import type { Translate } from '@/lib/i18n/t';

export function GridEmptyState({ t }: { t: Translate }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 flex-col items-center gap-2 px-6 text-center">
      <CalendarPlus
        size={28}
        strokeWidth={1.75}
        className="text-ink-soft"
        aria-hidden
      />
      <p className="text-sm font-medium text-ink">{t('grid.emptyTitle')}</p>
      <p className="text-sm text-ink-soft">{t('grid.emptyBody')}</p>
    </div>
  );
}
