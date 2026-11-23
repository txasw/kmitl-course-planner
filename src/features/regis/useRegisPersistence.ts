// Binds the registration helper store to storage: on mount it reads the kits and the
// checklist marks, a failed read counting as empty so a storage fault never blocks the
// dock, and binds the repositories the store writes through.

import { useEffect } from 'react';
import {
  bindRegisRepositories,
  regisStore,
  type RegisRepositories,
} from './regisStore';

export function useRegisPersistence(repos: RegisRepositories): void {
  useEffect(() => {
    let cancelled = false;
    bindRegisRepositories(repos);
    void Promise.allSettled([repos.kits.load(), repos.checklists.load()]).then(
      ([kits, checklists]) => {
        if (cancelled) return;
        regisStore
          .getState()
          .hydrate(
            kits.status === 'fulfilled' ? kits.value : [],
            checklists.status === 'fulfilled' ? checklists.value : [],
          );
      },
    );
    return () => {
      cancelled = true;
      bindRegisRepositories(null);
    };
  }, [repos]);
}
