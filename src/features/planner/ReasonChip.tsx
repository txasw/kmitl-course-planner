// The reason chip that follows the pointer during a blocked drag, naming the first
// blocking subject, section, day, and time, with a count when more conflicts
// exist. It renders inside the drag overlay, which the drag context positions at
// the pointer, so it needs no manual positioning of its own.

import type { ActiveDrag } from './dragStore';
import { useTranslation } from '@/features/shell/useTranslation';
import { describeConflicts } from '@/lib/planner/describeConflict';
import { conflictReasonText } from './conflictText';

export function ReasonChip({ active }: { active: ActiveDrag }) {
  const { t } = useTranslation();
  if (active.placement.ok) {
    return null;
  }
  const description = describeConflicts(active.placement.conflicts);
  if (description === null) {
    return null;
  }

  return (
    <div className="pointer-events-none rounded-kcp bg-danger px-2 py-1 text-xs font-medium text-white shadow-kcp">
      {conflictReasonText(description, t)}
    </div>
  );
}
