// The import rejection of the plan switcher menu. It lists the localized per field
// messages from parsePlanImport, so the user can find the offending fields, and
// offers a way back to the plan list. Nothing was committed when this shows.

import { AlertTriangle } from 'lucide-react';
import { useTranslation } from '@/features/shell/useTranslation';

export interface ImportErrorViewProps {
  issues: string[];
  onBack: () => void;
}

export function ImportErrorView({ issues, onBack }: ImportErrorViewProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-1.5 font-semibold text-ink">
        <AlertTriangle
          size={16}
          strokeWidth={2}
          className="shrink-0 text-danger"
          aria-hidden
        />
        {t('planData.errorTitle')}
      </p>
      <ul className="flex max-h-48 flex-col gap-1 overflow-auto kcp-scroll text-xs text-danger">
        {issues.map((issue, index) => (
          <li key={`${String(index)}-${issue}`}>{issue}</li>
        ))}
      </ul>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onBack}
          className="rounded-kcp border border-border px-2 py-1 text-ink-soft outline-none hover:bg-surface-alt hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {t('action.back')}
        </button>
      </div>
    </div>
  );
}
