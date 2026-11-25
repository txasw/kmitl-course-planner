// The registration helper on the two student registration pages (ADR-0076): the card
// and the one live region that announces what changes on it. Each arrival on a helper
// page starts a visit, so the card opens expanded every time (owner answer 5B), and the
// card stays out of the way while the planner overlay is open. The live region is the
// only source of the helper's announcements; nothing is read out when the card opens on
// its own.

import { useEffect } from 'react';
import { useStore } from 'zustand';
import { uiStore } from '@/features/shell/uiStore';
import { useTranslation } from '@/features/shell/useTranslation';
import { HelperCard } from './HelperCard';
import { announce, helperStore, startVisit } from './helperStore';
import { useCompanionRoute } from './useCompanion';
import { useHelperAnnouncements } from './useHelperAnnouncements';
import { useHelperModel } from './useHelperModel';

export function RegisHelper() {
  const route = useCompanionRoute();
  const overlayOpen = useStore(uiStore, (state) => state.isOpen);
  const collapsed = useStore(helperStore, (state) => state.collapsed);
  const hidden = useStore(helperStore, (state) => state.hidden);
  const announcement = useStore(helperStore, (state) => state.announcement);
  const model = useHelperModel();
  const { t } = useTranslation();
  useHelperAnnouncements(model, t);

  // Each arrival on a helper page, or a move between the two, is a new visit.
  useEffect(() => {
    if (route !== null) startVisit();
  }, [route]);
  useEffect(() => {
    if (hidden) announce(t('regis.hidden'));
  }, [hidden, t]);

  if (route === null) return null;
  return (
    <>
      {overlayOpen || collapsed ? null : <HelperCard model={model} />}
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement.text}
      </p>
    </>
  );
}
