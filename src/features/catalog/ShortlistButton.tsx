// The bookmark on a course card header, which saves the course to the browsed term's
// shortlist or removes it (ADR-0069). It sits beside the card's disclosure toggle,
// never inside it, and its press events stop at the control so a grab on it does not
// arm the course drag of the header around it. The name says what a press does and the
// card title describes it, so a screen reader hears which course it acts on.

import { Bookmark } from 'lucide-react';
import type { Translate } from '@/lib/i18n/t';
import { FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_SIZE } from '@/lib/ui/target';
import { NO_DRAG_ARMING } from '@/features/planner/dragArming';

interface ShortlistButtonProps {
  saved: boolean;
  /** The id of the card title, which describes the control. */
  describedBy: string;
  t: Translate;
  onToggle: () => void;
}

export function ShortlistButton({
  saved,
  describedBy,
  t,
  onToggle,
}: ShortlistButtonProps) {
  const label = t(saved ? 'shortlist.remove' : 'shortlist.add');
  // The native title names the icon for a mouse; a floating tooltip per card would
  // mount one more popup controller on each of hundreds of cards.
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-describedby={describedBy}
      data-shortlist-toggle
      {...NO_DRAG_ARMING}
      onClick={onToggle}
      className={`inline-flex shrink-0 items-center justify-center rounded-kcp hover:bg-surface-alt ${saved ? 'text-primary-strong' : 'text-ink-soft hover:text-ink'} ${TARGET_SIZE} ${FOCUS_RING}`}
    >
      <Bookmark
        size={16}
        strokeWidth={2}
        aria-hidden
        fill={saved ? 'currentColor' : 'none'}
      />
    </button>
  );
}
