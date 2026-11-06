// The per item actions of the updates dialog. Show on timetable closes the dialog and points
// at the section on the grid. A section no longer listed also offers its removal, since
// it stays on the grid at its last known time until the student takes it out; once removed,
// the item stays in the list as removed with an undo for as long as the plan's undo window
// holds it, so a removal from the review is never final by accident. The controls carry
// data attributes so focus can move between remove and undo as one replaces the other.

import { Eye, Undo2, X } from 'lucide-react';
import type { Translate } from '@/lib/i18n/t';
import type { UpdateItem } from '@/lib/planner/updateReview';
import { FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_SIZE } from '@/lib/ui/target';

const ACTION_BUTTON = `inline-flex items-center gap-1 rounded-kcp border border-border bg-surface px-2 py-0.5 text-xs text-ink hover:bg-surface-alt ${TARGET_SIZE} ${FOCUS_RING}`;

interface UpdateItemActionsProps {
  item: UpdateItem;
  t: Translate;
  /** Whether the student removed the section from this dialog. */
  removed: boolean;
  /** Whether the plan's pending undo still holds the removal. */
  canUndo: boolean;
  onShow: (item: UpdateItem) => void;
  onRemove: (item: UpdateItem) => void;
  onUndo: (item: UpdateItem) => void;
}

export function UpdateItemActions({
  item,
  t,
  removed,
  canUndo,
  onShow,
  onRemove,
  onUndo,
}: UpdateItemActionsProps) {
  const { teachTableId: id, subjectId, section } = item.entry;
  // Every item repeats the same actions, so each name carries its section, after the
  // visible label so the spoken name still starts with what the eye reads.
  const named = (label: string): string =>
    `${label} ${subjectId} ${t('section.code')} ${section}`;

  if (removed) {
    return (
      <p className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-ink-soft">{t('updates.removed')}</span>
        {canUndo ? (
          <button
            type="button"
            data-update-undo={id}
            aria-label={named(t('action.undo'))}
            onClick={() => {
              onUndo(item);
            }}
            className={ACTION_BUTTON}
          >
            <Undo2 size={12} strokeWidth={2} aria-hidden />
            {t('action.undo')}
          </button>
        ) : null}
      </p>
    );
  }

  return (
    <p className="flex flex-wrap gap-2">
      <button
        type="button"
        aria-label={named(t('updates.showOnGrid'))}
        onClick={() => {
          onShow(item);
        }}
        className={ACTION_BUTTON}
      >
        <Eye size={12} strokeWidth={2} aria-hidden />
        {t('updates.showOnGrid')}
      </button>
      {item.kinds.includes('missing') ? (
        <button
          type="button"
          data-update-remove={id}
          aria-label={named(t('updates.remove'))}
          onClick={() => {
            onRemove(item);
          }}
          className={ACTION_BUTTON}
        >
          <X size={12} strokeWidth={2} aria-hidden />
          {t('updates.remove')}
        </button>
      ) : null}
    </p>
  );
}
