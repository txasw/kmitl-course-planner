// The delete confirmation of the plan switcher menu. Deleting a plan cannot be
// undone, so the menu asks once, in one sentence that names the plan, states how many
// sections go with it, and says there is no undo, before the switcher deletes it.

import { ConfirmPrompt } from '@/components/ConfirmPrompt';
import { useTranslation } from '@/features/shell/useTranslation';
import { fillTemplate } from '@/lib/i18n/template';
import type { Translate } from '@/lib/i18n/t';

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
    <ConfirmPrompt
      message={deletePrompt(planName, sectionCount, t)}
      confirmLabel={t('planSwitcher.delete')}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
