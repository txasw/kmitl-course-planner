// The registration helper on the two student registration pages (ADR-0076): the card
// and the one live region that announces what changes on it. Each arrival on a helper
// page starts a visit, so the card opens expanded every time on a wide screen (owner
// answer 5B); on a narrow screen it starts collapsed to the launcher, so the host page,
// its countdown and its form, reads first, and opens on the student's press, and later
// visits there follow the student's own open or collapse earlier in this document. The card stays out of the way
// while the planner overlay is open. On the pre registration
// page the card waits for the observer's first reading, up to half a second, so it never
// opens on a status it is about to change; on the registration page, which KCP does not
// read, it opens at once. The live region is the only source of the helper's
// announcements; nothing is read out when the card opens on its own. The helper's fixed
// layers follow the part of the page on screen (HelperViewport).

import { useEffect } from 'react';
import { useStore } from 'zustand';
import { BREAKPOINTS } from '@/lib/ui/breakpoints';
import { uiStore } from '@/features/shell/uiStore';
import { useTranslation } from '@/features/shell/useTranslation';
import { HelperCard } from './HelperCard';
import { HelperViewport } from './HelperViewport';
import { hostStore } from './host/hostStore';
import { announce, helperStore, markReady, startVisit } from './helperStore';
import type { CompanionRoute } from '@/lib/regis/route';
import { useCompanionRoute } from './useCompanion';
import { useHelperAnnouncements } from './useHelperAnnouncements';
import { useHelperModel } from './useHelperModel';

/** The longest the card waits for the first page reading before it opens anyway. */
export const FIRST_READING_MS = 500;

function useFirstReading(route: CompanionRoute | null, ready: boolean): void {
  useEffect(() => {
    if (route === null || ready) return undefined;
    const read = () => hostStore.getState().health.status !== 'waiting';
    if (route !== 'preRegistration' || read()) {
      markReady();
      return undefined;
    }
    const unsubscribe = hostStore.subscribe(() => {
      if (read()) markReady();
    });
    const timer = window.setTimeout(markReady, FIRST_READING_MS);
    return () => {
      unsubscribe();
      window.clearTimeout(timer);
    };
  }, [route, ready]);
}

export function RegisHelper() {
  const route = useCompanionRoute();
  const overlayOpen = useStore(uiStore, (state) => state.isOpen);
  const collapsed = useStore(helperStore, (state) => state.collapsed);
  const hidden = useStore(helperStore, (state) => state.hidden);
  const ready = useStore(helperStore, (state) => state.ready);
  const announcement = useStore(helperStore, (state) => state.announcement);
  const model = useHelperModel();
  const { t } = useTranslation();
  useHelperAnnouncements(model, t);

  // Each arrival on a helper page, or a move between the two, is a new visit.
  useEffect(() => {
    if (route !== null) startVisit(window.innerWidth < BREAKPOINTS.sm);
  }, [route]);
  useFirstReading(route, ready);
  useEffect(() => {
    if (hidden) announce(t('regis.hidden'));
  }, [hidden, t]);

  if (route === null) return null;
  return (
    <>
      <HelperViewport />
      {overlayOpen || collapsed || !ready ? null : <HelperCard model={model} />}
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement.text}
      </p>
    </>
  );
}
