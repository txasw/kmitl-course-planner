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
import { useTranslation } from './useTranslation';
import { useFocusTrap } from './useFocusTrap';
import { useScrollLock } from './useScrollLock';
import { usePresence } from './usePresence';

// The full viewport overlay panel. It renders inside the closed shadow root as a
// modal dialog: focus is trapped while open, Escape and the close control return
// to the host, the host document scroll is locked, and enter and leave fade with
// a reduced motion path. Session state lives in the ui store, so closing and
// reopening within a page session resumes where the user left off.
const TITLE_ID = 'kcp-overlay-title';

export function Overlay() {
  const isOpen = useStore(uiStore, (state) => state.isOpen);
  const close = useStore(uiStore, (state) => state.close);
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement | null>(null);
  // Track the panel node in state as well, so the portal context updates once the node
  // mounts and floating-ui popups inside the transformed drawer can render into it.
  const [panelNode, setPanelNode] = useState<HTMLDivElement | null>(null);
  const attachPanel = useCallback((node: HTMLDivElement | null) => {
    panelRef.current = node;
    setPanelNode(node);
  }, []);
  const { mounted, stage } = usePresence(isOpen);

  // Focus enters the panel only once it is mounted; the lock follows the logical
  // open flag so it never waits on the leave animation.
  useFocusTrap(panelRef, isOpen && mounted, close);
  useScrollLock(isOpen);

  if (!mounted) return null;

  return (
    <div
      ref={attachPanel}
      role="dialog"
      aria-modal="true"
      aria-labelledby={TITLE_ID}
      tabIndex={-1}
      className={`fixed inset-0 z-[2147483647] flex flex-col bg-surface text-ink outline-none transition-opacity duration-150 motion-reduce:transition-none ${
        stage === 'open' ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <Header titleId={TITLE_ID} />
      <QuarantineCard />
      {/* The boundary wraps the panel body, not the whole overlay, so a render error
          in the search, catalog, or planner shows the recovery card while the header
          keeps its close control and the sibling launcher stays alive. */}
      <ErrorBoundary
        fallback={(reset) => <PanelRecoveryCard t={t} onReload={reset} />}
      >
        {IS_DEBUG ? <CrashProbe /> : null}
        <main className="min-h-0 flex-1 overflow-hidden">
          <PanelPortalContext.Provider value={panelNode}>
            <Layout />
          </PanelPortalContext.Provider>
        </main>
      </ErrorBoundary>
    </div>
  );
}
