// The delete confirmation of the plan switcher menu. Deleting a plan cannot be
// undone, so the menu asks once, in one sentence that names the plan, states how many
// sections go with it, and says there is no undo, before the switcher deletes it.

import { useTranslation } from '@/features/shell/useTranslation';
import { fillTemplate } from '@/lib/i18n/template';
import type { Translate } from '@/lib/i18n/t';
import { TARGET_SIZE } from '@/lib/ui/target';

export interface DeleteConfirmProps {
  planName: string;
  /** The sections the plan holds, each half of a pair counted. */
  sectionCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}

function deletePrompt(name: string, count: number, t: Translate): string {
  if (count === 0) {
    return fillTemplate(t('planSwitcher.deletePromptEmpty'), { name });
  }
  if (count === 1) {
    return fillTemplate(t('planSwitcher.deletePromptOne'), { name });
  }
  return fillTemplate(t('planSwitcher.deletePrompt'), { name, count });
}

export function DeleteConfirm({
  planName,
  sectionCount,
  onCancel,
  onConfirm,
}: DeleteConfirmProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      <p className="text-ink">{deletePrompt(planName, sectionCount, t)}</p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className={`rounded-kcp border border-border px-2 py-1 text-ink-soft outline-none hover:bg-surface-alt hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${TARGET_SIZE}`}
        >
          {t('action.cancel')}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`rounded-kcp bg-danger px-2 py-1 font-semibold text-white outline-none hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${TARGET_SIZE}`}
        >
          {t('planSwitcher.delete')}
        </button>
      </div>
    </div>
  );
}
