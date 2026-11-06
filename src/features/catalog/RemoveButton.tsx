// The remove control on an added course. It uses the same X glyph as the remove
// control on a placed block, so one action reads the same on both surfaces, and it
// shows its short label as text. The accessible name extends that visible label with
// the subject and section, so a screen reader list of controls tells the removes
// apart while the spoken name still starts with the words on screen. The press events
// stop at the control so a grab on it does not arm a surrounding drag.

import { X } from 'lucide-react';
import { FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_MIN } from '@/lib/ui/target';
import type { Translate } from '@/lib/i18n/t';
import { NO_DRAG_ARMING } from '@/features/planner/dragArming';

/** The accessible name of a catalog remove control: the action, the subject id and
 * the section, for example นำออก 90592033 กลุ่มเรียน 901. */
export function removeSectionName(
  t: Translate,
  subjectId: string,
  section: string,
): string {
  return `${t('action.remove')} ${subjectId} ${t('section.code')} ${section}`;
}

interface RemoveButtonProps {
  /** The short visible label, for example นำออก. */
  label: string;
  /** The full name, which starts with the label and names the section. */
  accessibleName: string;
  onRemove: () => void;
}

export function RemoveButton({
  label,
  accessibleName,
  onRemove,
}: RemoveButtonProps) {
  return (
    <button
      type="button"
      aria-label={accessibleName}
      {...NO_DRAG_ARMING}
      onClick={onRemove}
      className={`inline-flex shrink-0 items-center gap-1 rounded-kcp px-1.5 py-1 text-xs text-ink-soft hover:bg-surface hover:text-ink ${TARGET_MIN} ${FOCUS_RING}`}
    >
      <X size={14} aria-hidden />
      <span>{label}</span>
    </button>
  );
}
