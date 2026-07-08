// Dependencies the search feature needs from outside the shadow tree: the typed
// send client and the last search repository. They are provided at the content
// entrypoint and read here through context, so the deep form components stay free
// of the browser binding and tests inject fakes without mocking the polyfill.

import { createContext, useContext, type ReactNode } from 'react';
import type { TypedSend } from '@/lib/messaging/sendTyped';
import type { SearchStateRepository } from '@/lib/storage/lastSearch';

export interface SearchDeps {
  send: TypedSend;
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
