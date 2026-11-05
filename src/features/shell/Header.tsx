import { useStore } from 'zustand';
import { List, X } from 'lucide-react';
import { uiStore } from './uiStore';
import { useTranslation } from './useTranslation';
import { PlanSwitcher } from '@/features/plans/PlanSwitcher';
import { LanguageToggle } from './LanguageToggle';
import { ModeToggle } from './ModeToggle';
import { DRAWER_ID } from './Layout';

interface HeaderProps {
  titleId: string;
}

// The overlay header. It carries the panel title, the plan switcher placeholder,
// the catalog sheet toggle for narrow viewports, the language toggle, and the
// close control. The title id is supplied by the overlay so the dialog can point
// its accessible name at it.
export function Header({ titleId }: HeaderProps) {
  const close = useStore(uiStore, (state) => state.close);
  const sheetOpen = useStore(uiStore, (state) => state.sheetOpen);
  const setSheetOpen = useStore(uiStore, (state) => state.setSheetOpen);
  const viewMode = useStore(uiStore, (state) => state.viewMode);
  const { t } = useTranslation();

  return (
    <header className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
      <div className="flex items-center gap-3">
        <h2 id={titleId} className="text-base font-semibold text-ink">
          {t('app.title')}
        </h2>
        <PlanSwitcher />
      </div>
      <div className="flex items-center gap-2">
        {viewMode === 'edit' ? (
          <button
            type="button"
            onClick={() => {
              setSheetOpen(!sheetOpen);
            }}
            aria-controls={DRAWER_ID}
            aria-expanded={sheetOpen}
            aria-label={t('catalog.open')}
            className="inline-flex items-center justify-center rounded-kcp p-2 text-ink-soft outline-none transition-colors hover:bg-surface-alt hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary xl:hidden"
          >
            <List size={20} strokeWidth={2} aria-hidden />
          </button>
        ) : null}
        <ModeToggle />
        <LanguageToggle />
        <button
          type="button"
          onClick={close}
          aria-label={t('action.close')}
          className="inline-flex items-center justify-center rounded-kcp p-2 text-ink-soft outline-none transition-colors hover:bg-surface-alt hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <X size={20} strokeWidth={2} aria-hidden />
        </button>
      </div>
    </header>
  );
}
