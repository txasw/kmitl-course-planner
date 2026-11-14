import { useStore } from 'zustand';
import { X } from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
import { FOCUS_RING } from '@/lib/ui/focus';
import { BREAKPOINTS, minWidthQuery } from '@/lib/ui/breakpoints';
import { TARGET_SIZE } from '@/lib/ui/target';
import { uiStore } from './uiStore';
import { useMediaQuery } from './useMediaQuery';
import { useTranslation } from './useTranslation';
import { PlanSwitcher } from '@/features/plans/PlanSwitcher';
import { LanguageToggle } from './LanguageToggle';
import { ModeToggle } from './ModeToggle';
import { CatalogToggle } from './CatalogToggle';
import { HeaderOverflowMenu } from './HeaderOverflowMenu';
import { SaveIndicator } from './SaveIndicator';

interface HeaderProps {
  titleId: string;
}

// The overlay header: one row that never wraps, 56 px high and 48 px on a short
// viewport, padded clear of the device safe areas. Below 640 px the padding and gaps
// tighten so six touch sized controls still fit a 320 px screen. The leading group
// holds the brand mark from 640 px, the panel title, the plan switcher, and the save
// indicator beside it, which narrows to its mark below 640 px; it is the only part that
// shrinks, and the switcher truncates the plan name before anything else gives way.
// The title shows from 1024 px and stays in the accessibility tree below as sr-only
// text, so the dialog's aria-labelledby always resolves. The trailing group never
// shrinks and carries the catalog toggle on the sheet tiers, the mode toggle, the
// language toggle from 1024 px or the overflow menu that holds the language below it,
// and the close control, which is always last so leaving the overlay stays one action
// away at every width.
export function Header({ titleId }: HeaderProps) {
  const close = useStore(uiStore, (state) => state.close);
  const { t } = useTranslation();
  const wide = useMediaQuery(minWidthQuery(BREAKPOINTS.lg));

  return (
    <header className="box-content flex h-14 shrink-0 items-center gap-2 border-b border-border pt-(--kcp-safe-top) pr-[calc(12px_+_var(--kcp-safe-right))] pl-[calc(12px_+_var(--kcp-safe-left))] sm:gap-4 sm:pr-[calc(16px_+_var(--kcp-safe-right))] sm:pl-[calc(16px_+_var(--kcp-safe-left))] [@media(max-height:800px)]:h-12">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <BrandMark className="hidden size-6 shrink-0 text-primary sm:block" />
        <h2
          id={titleId}
          className="sr-only shrink-0 text-base font-semibold text-ink lg:not-sr-only"
        >
          {t('app.title')}
        </h2>
        <PlanSwitcher />
        <SaveIndicator />
      </div>
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <CatalogToggle />
        <ModeToggle />
        {wide ? <LanguageToggle /> : <HeaderOverflowMenu />}
        <button
          type="button"
          onClick={close}
          aria-label={t('action.close')}
          className={`inline-flex shrink-0 items-center justify-center rounded-kcp p-2 text-ink-soft transition-colors hover:bg-surface-alt hover:text-ink ${TARGET_SIZE} ${FOCUS_RING}`}
        >
          <X size={20} strokeWidth={2} aria-hidden />
        </button>
      </div>
    </header>
  );
}
