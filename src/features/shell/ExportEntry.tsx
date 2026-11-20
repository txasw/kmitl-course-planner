// The one way into the export page and the one way back, recorded in the ADR-0022
// amendment. The edit header carries a single Export button with its icon and label; it
// opens the export page, which is the preview poster with its sharing toolbar. The
// export page header leads with a Back to editing button instead of the brand and the plan
// switcher. Escape, routed by the overlay focus trap, and the system back gesture return
// to editing too: the back button holds one history layer while the export page is open,
// above the overlay's own (ADR-0067), so a back gesture leaves the export page alone and a
// second one closes the panel.
// Each button unmounts when the page changes, which drops the focus it held, so the header
// hands focus to the other one when no other control has taken it.

import { useLayoutEffect, useRef, type RefObject } from 'react';
import { useStore } from 'zustand';
import { ArrowLeft, Share } from 'lucide-react';
import { FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_SIZE } from '@/lib/ui/target';
import { uiStore, type ViewMode } from './uiStore';
import { useBackToClose } from './useBackToClose';
import { focusIsLost, rootOf } from './useFocusTrap';
import { useTranslation } from './useTranslation';

const EXPORT_BUTTON_ID = 'kcp-export-entry';
const BACK_TO_EDIT_ID = 'kcp-export-back';

/** Leave the export page for the edit workspace. */
export function backToEditing(): void {
  uiStore.getState().setViewMode('edit');
}

// The label hides only below 360 px, the narrowest screens the header must fit, where
// it stays the accessible name as sr-only text.
export function ExportButton() {
  const { t } = useTranslation();
  return (
    <button
      id={EXPORT_BUTTON_ID}
      type="button"
      onClick={() => {
        uiStore.getState().setViewMode('preview');
      }}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-kcp-sm border border-border bg-surface px-2.5 py-1.5 text-sm whitespace-nowrap text-ink shadow-kcp-soft transition-colors hover:bg-surface-alt ${TARGET_SIZE} ${FOCUS_RING}`}
    >
      <Share size={16} strokeWidth={2} aria-hidden />
      <span className="max-[360px]:sr-only">{t('mode.export')}</span>
    </button>
  );
}

export function BackToEditButton() {
  const { t } = useTranslation();
  const isOpen = useStore(uiStore, (state) => state.isOpen);
  // The layer follows the open flag, not the mount, so a panel closed from the export page
  // unwinds this entry before the overlay's while the header still renders its fade.
  useBackToClose(isOpen, backToEditing);
  return (
    <button
      id={BACK_TO_EDIT_ID}
      type="button"
      onClick={backToEditing}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-kcp py-1.5 pr-3 pl-2 text-sm font-semibold whitespace-nowrap text-ink transition-colors hover:bg-surface-alt ${TARGET_SIZE} ${FOCUS_RING}`}
    >
      <ArrowLeft size={18} strokeWidth={2} aria-hidden />
      <span>{t('mode.backToEdit')}</span>
    </button>
  );
}

/**
 * Moves focus to the button of the page just entered when the page change dropped it,
 * as it does when the pressed button unmounts or Escape leaves the export page from one
 * of its controls. Focus that another control took, such as a dialog the change opened,
 * stays where it is.
 */
export function useExportFocusHandoff(
  nodeRef: RefObject<HTMLElement | null>,
  viewMode: ViewMode,
): void {
  const previous = useRef(viewMode);
  useLayoutEffect(() => {
    if (previous.current === viewMode) return;
    previous.current = viewMode;
    const node = nodeRef.current;
    if (node === null || !focusIsLost(node)) return;
    const id = viewMode === 'preview' ? BACK_TO_EDIT_ID : EXPORT_BUTTON_ID;
    rootOf(node)?.getElementById(id)?.focus();
  }, [nodeRef, viewMode]);
}
