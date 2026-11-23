// The one line at the head of the catalog column on a host registration page (ADR-0075).
// It says why nothing loads on its own there and that a search or a check still runs, so
// a student who presses one knows it reaches a busy system. It is static text rather
// than a live region, since it describes the page rather than an outcome.

import { Info } from 'lucide-react';
import { useTranslation } from '@/features/shell/useTranslation';
import { useQuietRoute } from '@/features/shell/quietRoute';

export function QuietNotice() {
  const { t } = useTranslation();
  const quiet = useQuietRoute();
  if (!quiet) {
    return null;
  }
  return (
    <p
      data-quiet-notice
      className="flex flex-none items-start gap-2 border-b border-border bg-surface-alt px-6 py-2 text-xs text-ink-soft"
    >
      <Info
        size={14}
        strokeWidth={2}
        aria-hidden
        className="mt-0.5 flex-none"
      />
      <span>{t('search.quietNotice')}</span>
    </p>
  );
}
