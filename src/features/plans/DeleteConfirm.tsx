// The delete confirmation of the plan switcher menu. Deleting a plan cannot be
// undone, so the menu asks once, naming the plan, before the switcher deletes it.

import { useTranslation } from '@/features/shell/useTranslation';

export interface DeleteConfirmProps {
  planName: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteConfirm({
  planName,
  onCancel,
  onConfirm,
}: DeleteConfirmProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      <p className="text-ink">
        {t('planSwitcher.deletePrompt')} {planName}
      </p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-kcp border border-border px-2 py-1 text-ink-soft outline-none hover:bg-surface-alt hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {t('action.cancel')}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-kcp bg-danger px-2 py-1 font-semibold text-white outline-none hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {t('planSwitcher.delete')}
        </button>
      </div>
    </div>
  );
}
