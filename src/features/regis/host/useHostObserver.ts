// The read only observer's lifecycle on the pre registration page (ADR-0077). It reads
// the page once on arrival and again 150 ms after the watched roots settle, through one
// MutationObserver scoped to the registration panel, the dialogs, and the toasts, at most
// once a second while the page shows no panel (watchPage.ts), and stops for the document
// once the health machine turns it off. The student's Check again
// starts the reading over, and the health machine keeps it off once it is off. It sends
// no request, stores nothing, and acts on nothing: a reading only updates the memory
// store. The helper names no plan until the page term is read, for at most TERM_WAIT_MS
// on each arrival, so a page that never shows its header still gets a checklist.

import { useEffect } from 'react';
import { useStore } from 'zustand';
import { isTestedBuild } from '@/lib/regis/hostContract';
import { useCompanionRoute, useHelperPlanPick } from '../useCompanion';
import { readHostPage, readScriptNames, type PageReading } from './hostDom';
import { hostStore } from './hostStore';
import { isSurrogateSession } from './surrogate';
import { watchHostPage } from './watchPage';

/** The longest the helper waits for the page term before it falls back to the active plan. */
export const TERM_WAIT_MS = 15_000;

function plannedKeyOf(subjectIds: readonly string[]): string {
  return [...new Set(subjectIds)].sort().join(' ');
}

export function useHostObserver(): void {
  const onPage = useCompanionRoute() === 'preRegistration';
  const checks = useStore(hostStore, (state) => state.checks);
  // The planned ids are those of the plan the helper shows, which follows the page term.
  const pick = useHelperPlanPick();
  const plannedKey = plannedKeyOf(
    pick.kind === 'plan'
      ? pick.plan.entries.map((entry) => entry.subjectId)
      : [],
  );
  // The page and its term are forgotten only on leaving it; reading it again for another
  // planned set or a Check again starts over and keeps the term the header showed.
  useEffect(() => {
    if (!onPage) return undefined;
    const timer = window.setTimeout(() => {
      hostStore.getState().endTermWait();
    }, TERM_WAIT_MS);
    return () => {
      window.clearTimeout(timer);
      hostStore.getState().leave();
    };
  }, [onPage]);
  useEffect(() => {
    if (!onPage) return;
    const planned = new Set(plannedKey.split(' ').filter((id) => id !== ''));
    const end = watchHostPage(document, () => {
      const gate = {
        surrogate: isSurrogateSession(),
        testedBuild: isTestedBuild(readScriptNames(document)),
      };
      const open = !gate.surrogate && gate.testedBuild;
      const reading: PageReading = open
        ? readHostPage(document, planned)
        : { reading: 'absent' };
      hostStore.getState().record(gate, reading);
      return hostStore.getState().health.status === 'off'
        ? 'off'
        : reading.reading;
    });
    return () => {
      end();
      hostStore.getState().restart();
    };
  }, [onPage, plannedKey, checks]);
}
