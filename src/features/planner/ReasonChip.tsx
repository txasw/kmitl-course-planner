// The reason card that follows the pointer during a blocked drag. It names which section
// clashes on one line and when it clashes on the next, with a count when more conflicts
// exist, so a cramped red-on-red sentence is replaced by readable lines. It reads on the
// surface with a danger accent, an alert glyph and a danger left border, so it stays
// distinct from the neutral block hover card while still reading danger at a glance. It
// renders inside the drag overlay, which the drag context anchors below the grab card and
// off the cursor, so it needs no positioning of its own.

import { AlertTriangle } from 'lucide-react';
import type { ActiveDrag } from './dragStore';
import { useTranslation } from '@/features/shell/useTranslation';
import { describeConflicts } from '@/lib/planner/describeConflict';
import { conflictReasonParts } from './conflictText';

export function ReasonChip({ active }: { active: ActiveDrag }) {
  const { t } = useTranslation();
  if (active.placement.ok) {
    return null;
  }
  const description = describeConflicts(active.placement.conflicts);
  if (description === null) {
    return null;
  }
  const { headline, detail } = conflictReasonParts(description, t);

  return (
    <div className="pointer-events-none flex max-w-60 items-start gap-1.5 rounded-kcp border border-l-2 border-border border-l-danger bg-surface py-1 pr-2 pl-1.5 text-xs shadow-kcp">
      <AlertTriangle
        size={13}
        strokeWidth={2.25}
        aria-hidden
        className="mt-0.5 shrink-0 text-danger"
      />
      <div className="min-w-0">
        <p className="font-medium text-ink">{headline}</p>
        {detail !== null ? <p className="text-ink-soft">{detail}</p> : null}
        {description.moreCount > 0 ? (
          <p className="text-ink-soft">
            +{String(description.moreCount)} {t('feedback.moreConflicts')}
          </p>
        ) : null}
      </div>
    </div>
  );
}
