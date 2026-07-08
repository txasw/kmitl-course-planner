import type { PrefsRepository } from '@/lib/storage/prefs';
import { Launcher } from '@/features/shell/Launcher';
import { Overlay } from '@/features/shell/Overlay';
import { Toaster } from '@/features/shell/Toaster';
import { useLanguagePersistence } from '@/features/shell/useLanguagePersistence';
import {
  SearchDepsProvider,
  type SearchDeps,
} from '@/features/search/SearchDepsContext';
import { DiagnosticsGate } from '@/features/diagnostics/DiagnosticsGate';

interface AppProps {
  prefs: PrefsRepository;
  search: SearchDeps;
}

// Root component for the content script UI. It renders the launcher and the
// overlay, hydrates and persists the language through the injected repository,
// and provides the search dependencies so the deep form components stay free of
// the browser binding. The storage and messaging bindings stay at the entrypoint.
export function App({ prefs, search }: AppProps) {
  useLanguagePersistence(prefs);
  return (
    <SearchDepsProvider value={search}>
      <Launcher />
      <Overlay />
      <DiagnosticsGate />
      <Toaster />
    </SearchDepsProvider>
  );
}
