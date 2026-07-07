import type { PrefsRepository } from '@/lib/storage/prefs';
import { Launcher } from '@/features/shell/Launcher';
import { Overlay } from '@/features/shell/Overlay';
import { useLanguagePersistence } from '@/features/shell/useLanguagePersistence';

interface AppProps {
  prefs: PrefsRepository;
}

// Root component for the content script UI. It renders the launcher and the
// overlay, and hydrates and persists the language preference through the
// injected repository, so the storage binding stays at the entrypoint boundary.
export function App({ prefs }: AppProps) {
  useLanguagePersistence(prefs);
  return (
    <>
      <Launcher />
      <Overlay />
    </>
  );
}
