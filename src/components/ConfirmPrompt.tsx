// A one sentence confirmation built into the page, never window.confirm: the sentence names
// what the action removes, then a cancel and a destructive confirm in the danger fill. Both
// buttons take the sentence as their description, so a screen reader that lands on either
// hears what it confirms. Used by the plan delete in the switcher menu and the clear plan
// action of the suggestion dialog.

import { useId, type RefObject } from 'react';
import { useTranslation } from '@/features/shell/useTranslation';
import { FOCUS_OUTLINE, FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_SIZE } from '@/lib/ui/target';

export interface ConfirmPromptProps {
  message: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  /** Takes the cancel button, so the opener can move focus to the safe choice. */
  cancelRef?: RefObject<HTMLButtonElement | null>;
}

export function ConfirmPrompt({
  message,
  confirmLabel,
  onCancel,
  onConfirm,
  cancelRef,
}: ConfirmPromptProps) {
  const { t } = useTranslation();
  const messageId = useId();
  return (
    <div className="flex flex-col gap-2">
      <p id={messageId} className="text-ink">
        {message}
      </p>
      <div className="flex justify-end gap-2">
        <button
          ref={cancelRef}
          type="button"
          aria-describedby={messageId}
          onClick={onCancel}
          className={`rounded-kcp border border-border bg-surface px-2 py-1 text-ink-soft hover:bg-surface-alt hover:text-ink ${FOCUS_RING} ${TARGET_SIZE}`}
        >
          {t('action.cancel')}
        </button>
        <button
          type="button"
          aria-describedby={messageId}
          onClick={onConfirm}
          className={`rounded-kcp bg-danger px-2 py-1 font-semibold text-white hover:opacity-90 ${FOCUS_OUTLINE} ${TARGET_SIZE}`}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
