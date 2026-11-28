import { useCallback, useRef, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { uiStore } from './uiStore';
import { backToEditing } from './ExportEntry';
import { PanelFrame } from './PanelFrame';
import { TOAST_SATELLITES } from './toastStore';
import { useFocusTrap } from './useFocusTrap';
import { useScrollLock } from './useScrollLock';
import { useBackToClose } from './useBackToClose';
import { usePresence } from './usePresence';
import { useVisualViewportInset } from './useVisualViewportInset';
import { VIEWPORT_FIT } from '@/lib/ui/viewportInset';

// The full viewport overlay panel. It renders the shared panel frame inside the closed
// shadow root as a modal dialog: focus is trapped while open, Escape and the close
// control return to the host, except that Escape on the export page returns to editing
// first, the host document scroll is locked, and enter and leave fade with a reduced
// motion path. A back gesture closes it too, through one history entry it holds while
// open, recorded in ADR-0067. Session state lives in the ui store, so closing and
// reopening within a page session resumes where the user left off. The header pads
// itself clear of the top and side safe area insets.
// The panel fills the visible part of the viewport rather than the layout viewport, so a
// phone keyboard shrinks it instead of covering its foot, and the sheets and dialogs it
// hosts fit the same area. A layer the overlay hosts above its body, such as the product
// tour, comes in as children, so it renders inside the portal context and the trap.
const TITLE_ID = 'kcp-overlay-title';

interface OverlayProps {
  /** Layers that render above the panel body inside the panel node. */
  children?: ReactNode;
}

export function Overlay({ children }: OverlayProps) {
  const isOpen = useStore(uiStore, (state) => state.isOpen);
  const close = useStore(uiStore, (state) => state.close);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const { mounted, stage } = usePresence(isOpen);

  // Escape that no inner surface claimed leaves the export page first and closes the
  // panel only from editing, the same order as the back gesture (ADR-0022 amendment).
  const handleEscape = useCallback(() => {
    if (uiStore.getState().viewMode === 'preview') {
      backToEditing();
    } else {
      close();
    }
  }, [close]);

  // Focus enters the panel only once it is mounted; the lock follows the logical
  // open flag so it never waits on the leave animation.
  // The toast region stays on its own layer outside the panel, so the trap takes its
  // controls into the Tab order rather than leaving an undo out of keyboard reach.
  useFocusTrap(panelRef, isOpen && mounted, handleEscape, TOAST_SATELLITES);
  useScrollLock(isOpen);
  useBackToClose(isOpen, close);
  useVisualViewportInset(panelRef, mounted);

  if (!mounted) return null;

  return (
    <PanelFrame
      titleId={TITLE_ID}
      active={isOpen}
      nodeRef={panelRef}
      nodeAttributes={{
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': TITLE_ID,
      }}
      className={`fixed ${VIEWPORT_FIT} z-host transition-opacity duration-fast motion-reduce:transition-none ${
        stage === 'open' ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {children}
    </PanelFrame>
  );
}
