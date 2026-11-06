// The node the welcome renders into. It exists only while the welcome is open, mounted
// last in the shadow root at the host layer, so it stacks above the launcher, the overlay
// and the toasts by mount order. The modal dialog and the bottom sheet portal through
// PanelPortalContext, which only the overlay provides, so this layer provides its own
// node; it also carries the panel language, since the host document's lang does not
// follow the language toggle. It holds the host scroll lock while it is open, counted
// with the overlay's, so the welcome handing over to the panel in one commit keeps the
// host locked and closing both leaves it as it was.

import { useState } from 'react';
import { useStore } from 'zustand';
import { PanelPortalContext } from '@/features/shell/PanelPortalContext';
import { useScrollLock } from '@/features/shell/useScrollLock';
import { useTranslation } from '@/features/shell/useTranslation';
import { onboardingStore } from './onboardingStore';
import { WelcomeDialog } from './WelcomeDialog';

export function WelcomeLayer() {
  const open = useStore(onboardingStore, (state) => state.welcomeOpen);
  return open ? <OpenWelcomeLayer /> : null;
}

function OpenWelcomeLayer() {
  const { language } = useTranslation();
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  useScrollLock(true);
  return (
    <div
      ref={setNode}
      lang={language}
      className="fixed inset-0 z-host text-ink"
    >
      <PanelPortalContext.Provider value={node}>
        <WelcomeDialog />
      </PanelPortalContext.Provider>
    </div>
  );
}
