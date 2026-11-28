// Dependencies the search feature needs from outside the shadow tree: the typed
// send client and the last search repository. They are provided at the content
// entrypoint and read here through context, so the deep form components stay free
// of the browser binding and tests inject fakes without mocking the polyfill.

import { createContext, useContext, type ReactNode } from 'react';
import type { CoreSend } from '@/lib/messaging/envelope';
import type { SearchStateRepository } from '@/lib/storage/lastSearch';

/**
 * The dependencies, typed by the core send every consumer here needs. A program whose
 * send carries more messages names its own send type, as the extension root does, and
 * that value still provides this context.
 */
export interface SearchDeps<Send extends CoreSend = CoreSend> {
  send: Send;
  repo: SearchStateRepository;
}

const SearchDepsContext = createContext<SearchDeps | null>(null);

interface ProviderProps {
  value: SearchDeps;
  children: ReactNode;
}

export function SearchDepsProvider({ value, children }: ProviderProps) {
  return (
    <SearchDepsContext.Provider value={value}>
      {children}
    </SearchDepsContext.Provider>
  );
}

export function useSearchDeps(): SearchDeps {
  const deps = useContext(SearchDepsContext);
  if (deps === null) {
    throw new Error('search dependencies were not provided');
  }
  return deps;
}

/**
 * The dependencies when a provider gives them, or null, for a part that offers a network
 * action only where the content script bound one.
 */
export function useOptionalSearchDeps(): SearchDeps | null {
  return useContext(SearchDepsContext);
}
