import { useCallback, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { QuarantineCard } from '@/features/plans/QuarantineCard';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PanelRecoveryCard } from '@/components/PanelRecoveryCard';
import { IS_DEBUG } from '@/lib/env';
import { uiStore } from './uiStore';
import { PanelPortalContext } from './PanelPortalContext';
import { Header } from './Header';
import { Layout } from './Layout';
import { CrashProbe } from './CrashProbe';
import { useBottomNavShown } from './mobilePane';
import { useTranslation } from './useTranslation';
import { useFocusTrap } from './useFocusTrap';
import { useScrollLock } from './useScrollLock';
import { useBackToClose } from './useBackToClose';
import { usePresence } from './usePresence';

// The full viewport overlay panel. It renders inside the closed shadow root as a
// modal dialog: focus is trapped while open, Escape and the close control return
// to the host, the host document scroll is locked, and enter and leave fade with
// a reduced motion path. A back gesture closes it too, through one history entry it holds
// while open, recorded in ADR-0067. Session state lives in the ui store, so closing and
// reopening within a page session resumes where the user left off. The root
// carries the panel language, because the host document's own lang does not follow
// the language toggle, and the popovers portal into this node so they inherit it.
// The header pads itself clear of the top and side safe area insets, and the body pads
// clear of the side insets and of the bottom one, except while the bottom nav runs along
// its foot: the nav pads itself there, so its fill reaches the screen edge under the
// home indicator. The portal context covers the header as well as the body, so a header
// control such as the plan switcher can open its bottom sheet over the whole panel.
const TITLE_ID = 'kcp-overlay-title';

export function Overlay() {
  const isOpen = useStore(uiStore, (state) => state.isOpen);
  const close = useStore(uiStore, (state) => state.close);
  const { t, language } = useTranslation();
  const panelRef = useRef<HTMLDivElement | null>(null);
  // Track the panel node in state as well, so the portal context updates once the node
  // mounts and floating-ui popups inside the transformed sheet can render into it.
  const [panelNode, setPanelNode] = useState<HTMLDivElement | null>(null);
  const attachPanel = useCallback((node: HTMLDivElement | null) => {
    panelRef.current = node;
    setPanelNode(node);
  }, []);
  const { mounted, stage } = usePresence(isOpen);
  const navShown = useBottomNavShown();

  // Focus enters the panel only once it is mounted; the lock follows the logical
  // open flag so it never waits on the leave animation.
  useFocusTrap(panelRef, isOpen && mounted, close);
  useScrollLock(isOpen);
  useBackToClose(isOpen, close);

  if (!mounted) return null;

  return (
    <div
      ref={attachPanel}
      role="dialog"
      aria-modal="true"
      aria-labelledby={TITLE_ID}
      lang={language}
      tabIndex={-1}
      className={`fixed inset-0 z-host flex flex-col bg-surface text-ink outline-none transition-opacity duration-fast motion-reduce:transition-none ${
        stage === 'open' ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <PanelPortalContext.Provider value={panelNode}>
        <Header titleId={TITLE_ID} />
        <QuarantineCard />
        {/* The boundary wraps the panel body, not the whole overlay, so a render
            error in the search, catalog, or planner shows the recovery card while the
            header keeps its close control and the sibling launcher stays alive. */}
        <ErrorBoundary
          fallback={(reset) => <PanelRecoveryCard t={t} onReload={reset} />}
        >
          {IS_DEBUG ? <CrashProbe /> : null}
          <main
            className={`min-h-0 flex-1 overflow-hidden pr-(--kcp-safe-right) pl-(--kcp-safe-left) ${
              navShown ? '' : 'pb-(--kcp-safe-bottom)'
            }`}
          >
            <Layout />
          </main>
        </ErrorBoundary>
      </PanelPortalContext.Provider>
    </div>
  );
}
