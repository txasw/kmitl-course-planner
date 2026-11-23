// A read only line above the host's confirm dialog when the page list differs from the
// plan (owner answer 22A, ADR-0077), for example that the page holds 3 of the 6 planned
// subjects. It holds no control and takes no focus, so the dialog's own focus trap is
// untouched, and it lets every press through to the page beneath it.

import { useStore } from 'zustand';
import { fillTemplate } from '@/lib/i18n/template';
import { useTranslation } from '@/features/shell/useTranslation';
import { useCompanionView } from '../useCompanion';
import { hostStore } from './hostStore';

export function ConfirmBanner() {
  const dialog = useStore(hostStore, (state) => state.page?.observation.dialog);
  const { checklist } = useCompanionView();
  const { t } = useTranslation();
  if (dialog?.kind !== 'confirmSubmit' || checklist === null) return null;
  const { listedPlanned, total, extras } = checklist;
  if (listedPlanned === total && extras.length === 0) return null;
  return (
    <div
      role="status"
      data-confirm-banner
      className="pointer-events-none fixed inset-x-4 top-4 z-host mx-auto max-w-md rounded-kcp bg-warn px-3 py-2 text-center text-sm font-semibold text-white shadow-kcp"
    >
      {fillTemplate(t('regis.banner'), { listed: listedPlanned, total })}
    </div>
  );
}
