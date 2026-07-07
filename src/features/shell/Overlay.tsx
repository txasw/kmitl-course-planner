import { useRef } from 'react';
import { useStore } from 'zustand';
import { uiStore } from './uiStore';
import { Header } from './Header';
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
  const panelRef = useRef<HTMLDivElement>(null);
  const { mounted, stage } = usePresence(isOpen);

  // Focus enters the panel only once it is mounted; the lock follows the logical
  // open flag so it never waits on the leave animation.
  useFocusTrap(panelRef, isOpen && mounted, close);
  useScrollLock(isOpen);

  if (!mounted) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={TITLE_ID}
      tabIndex={-1}
      className={`fixed inset-0 z-[2147483647] flex flex-col bg-surface text-ink outline-none transition-opacity duration-150 motion-reduce:transition-none ${
        stage === 'open' ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <Header titleId={TITLE_ID} />
      <main className="min-h-0 flex-1 overflow-hidden" />
    </div>
  );
}
