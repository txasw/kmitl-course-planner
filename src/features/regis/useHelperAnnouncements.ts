// What the registration helper's one live region says, and the toast a failed run shows.
// Status changes within half a second are read as one sentence: the subject and its new
// status when one subject changed, or how many changed when more did, so a page that
// settles several rows at once is not read out row by row, and a status that changes and
// changes back within the window is not read at all. The page turning unreadable or
// readable again, a run step, and a run stop are read as they happen. A run that fails,
// because a step was not confirmed in time or the page could not be read, also shows the
// error toast, which stays on screen after the card is collapsed.

import { useEffect, useRef } from 'react';
import { fillTemplate } from '@/lib/i18n/template';
import type { Translate } from '@/lib/i18n/t';
import type { StopReason } from '@/lib/regis/fillPlan';
import type { HelperStatus } from '@/lib/regis/helperStatus';
import { toastStore } from '@/features/shell/toastStore';
import { STEP_WORD, stepNumber } from './fill/FillControls';
import type { FillRun } from './fill/fillRun';
import { announce } from './helperStore';
import { bandKey } from './statusMeta';
import type { HelperModel } from './useHelperModel';

/** How long status changes gather before they are read as one sentence. */
export const GROUP_MS = 500;

/** The stops that are a failure of the run itself, not the page turning a subject down. */
const FAILED: readonly StopReason[] = [
  'noAnswer',
  'pageChanged',
  'notRecognised',
];

type Statuses = Readonly<Record<string, HelperStatus>>;

function useStatusAnnouncements(
  statuses: Statuses,
  stale: boolean,
  t: Translate,
): void {
  const before = useRef<{ statuses: Statuses; stale: boolean } | null>(null);
  // Each changed subject's status when the window opened, and its latest one.
  const pending = useRef(
    new Map<string, { from: HelperStatus; to: HelperStatus }>(),
  );
  const timer = useRef<number | null>(null);
  const latestT = useRef(t);
  useEffect(() => {
    latestT.current = t;
  }, [t]);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  useEffect(() => {
    const last = before.current;
    before.current = { statuses, stale };
    if (last === null) return;
    const gathered = pending.current;
    if (last.stale !== stale) {
      gathered.clear();
      announce(t(stale ? 'regis.unreadable' : 'regis.readableAgain'));
      return;
    }
    for (const [id, to] of Object.entries(statuses)) {
      const from = last.statuses[id];
      if (from === undefined || from === to) continue;
      const open = gathered.get(id);
      gathered.set(id, { from: open?.from ?? from, to });
    }
    if (gathered.size === 0 || timer.current !== null) return;
    timer.current = window.setTimeout(() => {
      timer.current = null;
      const changed = [...gathered].filter(
        ([, change]) => change.from !== change.to && change.to !== 'adding',
      );
      gathered.clear();
      const tr = latestT.current;
      const [only] = changed;
      if (changed.length > 1) {
        announce(
          fillTemplate(tr('regis.statusChangedMany'), {
            count: changed.length,
          }),
        );
      } else if (only !== undefined) {
        announce(`${only[0]} ${tr(bandKey(only[1].to))}`);
      }
    }, GROUP_MS);
  }, [statuses, stale, t]);
}

function useRunAnnouncements(run: FillRun, t: Translate): void {
  const stepAt = run.status === 'running' ? stepNumber(run.step) : null;
  const runningId = run.status === 'running' ? run.subjectId : null;
  useEffect(() => {
    if (stepAt !== null && runningId !== null) {
      announce(
        `${fillTemplate(t('regis.stepOf'), { n: stepAt })} ${t(STEP_WORD[stepAt])}`,
      );
    }
  }, [stepAt, runningId, t]);

  // Each stopped run is a new object, so a second stop for the same reason is read too;
  // the stop the helper finds on arrival was read when it happened.
  const stopped = run.status === 'stopped' ? run : null;
  const seen = useRef(stopped);
  useEffect(() => {
    if (stopped === null || stopped === seen.current) return;
    seen.current = stopped;
    announce(t(`regis.fill.stop.${stopped.reason}`));
    if (FAILED.includes(stopped.reason)) {
      toastStore.getState().show('error', t('regis.addForMe.failed'));
    }
  }, [stopped, t]);
}

export function useHelperAnnouncements(model: HelperModel, t: Translate): void {
  useStatusAnnouncements(model.statuses, model.stale, t);
  useRunAnnouncements(model.run, t);
}
