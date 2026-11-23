// Binds the registration helper store to storage: on mount it reads the kits, the
// section choices, and the fill settings, a failed read counting as empty so a storage
// fault never blocks the dock, and binds the repositories the store writes through.

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
    void Promise.allSettled([repos.kits.load(), repos.choices.load()]).then(
      ([kits, choices]) => {
        if (cancelled) return;
        regisStore
          .getState()
          .hydrate(
            kits.status === 'fulfilled' ? kits.value : [],
            choices.status === 'fulfilled' ? choices.value : [],
          );
      },
    );
    void repos.fill.load().then(
      (fill) => {
        if (!cancelled) regisStore.getState().hydrateFill(fill);
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
      bindRegisRepositories(null);
    };
  }, [repos]);
}
