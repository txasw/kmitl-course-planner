import { useRef } from 'react';
import { useStore } from 'zustand';
import { X } from 'lucide-react';
import { FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_SIZE } from '@/lib/ui/target';
import { uiStore } from './uiStore';
import { useTranslation } from './useTranslation';
import { PlanSwitcher } from '@/features/plans/PlanSwitcher';
import {
  BackToEditButton,
  ExportButton,
  useExportFocusHandoff,
} from './ExportEntry';
import { CatalogToggle } from './CatalogToggle';
import { HeaderOverflowMenu } from './HeaderOverflowMenu';
import { HeaderBrand } from './HeaderBrand';

interface HeaderProps {
  titleId: string;
}

// The overlay header: one row that never wraps, 56 px high and 48 px on a short
// viewport, padded clear of the device safe areas. Below 640 px the padding and gaps
// tighten so the touch sized controls still fit a 320 px screen. The leading group
// holds the brand mark with its version pill from 640 px, the panel title, and the plan
// switcher; it is the only part that shrinks, and the switcher wraps the plan name onto
// two lines a step down the type scale before anything else gives way. A failed save
// shows in its own strip under the header, never in this row.
// The title shows from 1024 px and stays in the accessibility tree below as sr-only
// text, so the dialog's aria-labelledby always resolves. The trailing group never
// shrinks and carries the catalog toggle in edit mode on the medium tier, where the
// catalog is a sheet, then the export button, the overflow menu that holds the language
// on every tier, and the close control, which is always last so leaving the overlay
// stays one action away at every width.
// On the export page the leading group holds the back to editing button and the title
// only, since the poster names the plan and a plan is switched while editing, and the
// trailing group drops the export button (ADR-0022 amendment).
export function Header({ titleId }: HeaderProps) {
  const close = useStore(uiStore, (state) => state.close);
  const viewMode = useStore(uiStore, (state) => state.viewMode);
  const exporting = viewMode === 'preview';
  const headerRef = useRef<HTMLElement>(null);
  useExportFocusHandoff(headerRef, viewMode);
  const { t } = useTranslation();

  return (
    <header
      ref={headerRef}
      className="box-content flex h-14 shrink-0 items-center gap-2 border-b border-border pt-(--kcp-safe-top) pr-[calc(12px_+_var(--kcp-safe-right))] pl-[calc(12px_+_var(--kcp-safe-left))] sm:gap-4 sm:pr-[calc(16px_+_var(--kcp-safe-right))] sm:pl-[calc(16px_+_var(--kcp-safe-left))] [@media(max-height:800px)]:h-12"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {exporting ? <BackToEditButton /> : <HeaderBrand />}
        <h2
          id={titleId}
          className="sr-only shrink-0 text-base font-semibold text-ink lg:not-sr-only"
        >
          {t('app.title')}
        </h2>
        {exporting ? null : <PlanSwitcher />}
      </div>
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <CatalogToggle />
        {exporting ? null : <ExportButton />}
        <HeaderOverflowMenu />
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
