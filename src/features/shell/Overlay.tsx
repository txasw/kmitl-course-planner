import { useRef } from 'react';
import { useStore } from 'zustand';
import { X } from 'lucide-react';
import { uiStore } from './uiStore';
import { useTranslation } from './useTranslation';
import { useFocusTrap } from './useFocusTrap';
import { useScrollLock } from './useScrollLock';
import { usePresence } from './usePresence';

// The full viewport overlay panel. It renders inside the closed shadow root as a
// modal dialog: focus is trapped while open, Escape and the close control return
// to the host, the host document scroll is locked, and enter and leave fade with
// a reduced motion path. Its body is filled with the three region layout in a
// later step. Session state lives in the ui store, so closing and reopening
// within a page session resumes where the user left off.
const TITLE_ID = 'kcp-overlay-title';

export function Overlay() {
  const isOpen = useStore(uiStore, (state) => state.isOpen);
  const close = useStore(uiStore, (state) => state.close);
  const { t } = useTranslation();
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
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <h2 id={TITLE_ID} className="text-base font-semibold">
          {t('app.title')}
        </h2>
        <button
          type="button"
          onClick={close}
          aria-label={t('action.close')}
          className="inline-flex items-center justify-center rounded-kcp p-2 text-ink-soft outline-none transition-colors hover:bg-surface-alt hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <X size={20} strokeWidth={2} aria-hidden />
        </button>
      </header>
      <main className="min-h-0 flex-1 overflow-hidden" />
    </div>
  );
}
