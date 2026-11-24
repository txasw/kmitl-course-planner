// The registration helper on the two student registration pages (ADR-0076): the card
// and the one live region that announces what changes on it. Each arrival on a helper
// page starts a visit, so the card opens expanded every time (owner answer 5B), and the
// card stays out of the way while the planner overlay is open. The live region is the
// only source of the helper's announcements; nothing is read out when the card opens on
// its own.

import { useEffect, useRef } from 'react';
import { useStore } from 'zustand';
import { fillTemplate } from '@/lib/i18n/template';
import type { Translate } from '@/lib/i18n/t';
import { uiStore } from '@/features/shell/uiStore';
import { useTranslation } from '@/features/shell/useTranslation';
import { STEP_WORD, stepNumber } from './fill/FillControls';
import { HelperCard } from './HelperCard';
import { announce, helperStore, startVisit } from './helperStore';
import { bandKey } from './statusMeta';
import { useCompanionRoute } from './useCompanion';
import { useHelperModel, type HelperModel } from './useHelperModel';

function useAnnouncements(model: HelperModel, t: Translate): void {
  const { statuses, stale, run } = model;
  const before = useRef<{ statuses: typeof statuses; stale: boolean } | null>(
    null,
  );
  useEffect(() => {
    const last = before.current;
    before.current = { statuses, stale };
    if (last === null) return;
    if (last.stale !== stale) {
      announce(t(stale ? 'regis.unreadable' : 'regis.readableAgain'));
      return;
    }
    const changed = Object.keys(statuses).filter(
      (id) =>
        last.statuses[id] !== undefined &&
        last.statuses[id] !== statuses[id] &&
        statuses[id] !== 'adding',
    );
    const [only] = changed;
    if (changed.length > 1) {
      announce(
        fillTemplate(t('regis.statusChangedMany'), { count: changed.length }),
      );
    } else if (only !== undefined) {
      const status = statuses[only] ?? 'todo';
      announce(`${only} ${t(bandKey(status))}`);
    }
  }, [statuses, stale, t]);

  const stepAt = run.status === 'running' ? stepNumber(run.step) : null;
  const runningId = run.status === 'running' ? run.subjectId : null;
  const stopReason = run.status === 'stopped' ? run.reason : null;
  useEffect(() => {
    if (stepAt !== null && runningId !== null) {
      announce(
        `${fillTemplate(t('regis.stepOf'), { n: stepAt })} ${t(STEP_WORD[stepAt])}`,
      );
    } else if (stopReason !== null) {
      announce(t(`regis.fill.stop.${stopReason}`));
    }
  }, [stepAt, runningId, stopReason, t]);
}

export function RegisHelper() {
  const route = useCompanionRoute();
  const overlayOpen = useStore(uiStore, (state) => state.isOpen);
  const collapsed = useStore(helperStore, (state) => state.collapsed);
  const hidden = useStore(helperStore, (state) => state.hidden);
  const announcement = useStore(helperStore, (state) => state.announcement);
  const model = useHelperModel();
  const { t } = useTranslation();
  useAnnouncements(model, t);

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
