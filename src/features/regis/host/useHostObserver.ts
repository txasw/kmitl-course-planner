// The read only observer's lifecycle on the pre registration page (ADR-0077). It reads
// the page once on arrival and again 150 ms after the watched roots settle, through one
// MutationObserver scoped to the registration panel, the dialogs, and the toasts, and
// stops for the document once the health machine turns it off. It sends no request,
// stores nothing, and acts on nothing: a reading only updates the memory store.

import { useEffect } from 'react';
import { useStore } from 'zustand';
import { isTestedBuild } from '@/lib/regis/hostContract';
import { planStore } from '@/features/plans/planStore';
import { activePlanOf } from '@/features/plans/planStoreState';
import { useCompanionRoute } from '../useCompanion';
import { observedRoots, readHostPage, readScriptNames } from './hostDom';
import { hostStore } from './hostStore';
import { isSurrogateSession } from './surrogate';

const SETTLE_MS = 150;

function plannedKeyOf(subjectIds: readonly string[]): string {
  return [...new Set(subjectIds)].sort().join(' ');
}

export function useHostObserver(): void {
  const onPage = useCompanionRoute() === 'preRegistration';
  const plannedKey = useStore(planStore, (state) =>
    plannedKeyOf(
      activePlanOf(state)?.entries.map((entry) => entry.subjectId) ?? [],
    ),
  );
  useEffect(() => {
    if (!onPage) return;
    const planned = new Set(plannedKey.split(' ').filter((id) => id !== ''));
    let timer: number | undefined;
    const observer = new MutationObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(evaluate, SETTLE_MS);
    });
    function evaluate() {
      const gate = {
        surrogate: isSurrogateSession(),
        testedBuild: isTestedBuild(readScriptNames(document)),
      };
      const open = !gate.surrogate && gate.testedBuild;
      hostStore
        .getState()
        .record(
          gate,
          open ? readHostPage(document, planned) : { reading: 'absent' },
        );
      observer.disconnect();
      if (hostStore.getState().health.status === 'off') return;
      for (const [target, options] of observedRoots(document)) {
        observer.observe(target, options);
      }
    }
    evaluate();
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      hostStore.getState().leave();
    };
  }, [onPage, plannedKey]);
}
