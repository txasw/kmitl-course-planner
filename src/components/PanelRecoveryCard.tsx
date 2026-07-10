// The fallback the panel error boundary renders. It follows the empty state idiom:
// an icon, one line of title, one sentence, and a single reload action that clears
// the error and re-renders the panel. It is a dumb component that takes the
// translator and the reload handler, so it stays free of any store or context, and
// it renders inside the panel only, never touching the host page.

import { AlertTriangle } from 'lucide-react';
import type { Translate } from '@/lib/i18n/t';
import { EmptyState } from './EmptyState';

interface PanelRecoveryCardProps {
  t: Translate;
  onReload: () => void;
}

export function PanelRecoveryCard({ t, onReload }: PanelRecoveryCardProps) {
  return (
    <div role="alert" className="h-full">
      <EmptyState
        icon={AlertTriangle}
        title={t('panel.error.title')}
        description={t('panel.error.body')}
        action={
          <button
            type="button"
            onClick={onReload}
            className="rounded-kcp bg-primary-strong px-3 py-1.5 text-sm font-medium text-white outline-none hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {t('panel.error.reload')}
          </button>
        }
      />
    </div>
  );
}
