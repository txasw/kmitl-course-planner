// The fallback the panel error boundary renders. It follows the empty state idiom:
// an icon, one line of title, one sentence, and a single reload action that clears
// the error and re-renders the panel. It is a dumb component that takes the
// translator, the key of its sentence, and the reload handler, so it stays free of any
// store or context, and it renders inside the panel only, never touching the host page.

import { AlertTriangle } from 'lucide-react';
import type { Translate, TranslationKey } from '@/lib/i18n/t';
import { EmptyState, EmptyStateAction } from './EmptyState';

interface PanelRecoveryCardProps {
  t: Translate;
  /** The sentence under the title, which the root that mounts the panel chooses. */
  body: TranslationKey;
  onReload: () => void;
}

export function PanelRecoveryCard({
  t,
  body,
  onReload,
}: PanelRecoveryCardProps) {
  return (
    <div role="alert" className="h-full">
      <EmptyState
        icon={AlertTriangle}
        title={t('panel.error.title')}
        description={t(body)}
        action={
          <EmptyStateAction
            label={t('panel.error.reload')}
            variant="primary"
            onClick={onReload}
          />
        }
      />
    </div>
  );
}
