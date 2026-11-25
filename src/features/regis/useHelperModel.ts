// What the registration helper shows, read in one place: the companion view of the plan,
// each subject's status from the page and the fill run, the subject in focus, and the card
// level flags. The page is read only (ADR-0077), so every status here is the page's own,
// or the last one it showed while it cannot be read now.

import { useEffect, useMemo, useRef } from 'react';
import { useStore } from 'zustand';
import type { Plan } from '@/lib/domain/plan';
import type { Checklist, ChecklistRow } from '@/lib/regis/checklist';
import type { HelperPlanPick } from '@/lib/regis/helperPlan';
import {
  advanceCurrent,
  deriveHelperStatuses,
  doneCount,
  isDone,
  needsLook,
  pickCurrent,
  type HelperStatus,
} from '@/lib/regis/helperStatus';
import type { RegistrationKit } from '@/lib/regis/kitSchema';
import type { CompanionRoute } from '@/lib/regis/route';
import { canRecheck, type OffReason } from '@/lib/regis/observerHealth';
import { fillStore, type FillRun } from './fill/fillRun';
import { hostStore } from './host/hostStore';
import { helperStore, recordLast, setCurrent } from './helperStore';
import { useCompanionRoute, useCompanionView } from './useCompanion';

export interface HelperModel {
  route: CompanionRoute | null;
  /** Which plan of the page term the helper follows, or why it has none. */
  pick: HelperPlanPick;
  plan: Plan | null;
  kit: RegistrationKit | null;
  checklist: Checklist | null;
  statuses: Readonly<Record<string, HelperStatus>>;
  sent: boolean;
  /** Whether the page cannot be read now, so the statuses are the last known ones. */
  stale: boolean;
  /**
   * Whether Check again can change what KCP reads: always, except once the observer is off
   * on a host build KCP was not tested with or in a staff session, which no reading mends.
   */
  recheckable: boolean;
  /** Why the observer is off, or null while it is not. */
  offReason: OffReason | null;
  termMismatch: boolean;
  hasKit: boolean;
  /** Whether a subject is turned down or the page needs a look, for the launcher dot. */
  attention: boolean;
  done: number;
  total: number;
  current: ChecklistRow | null;
  /** Whether the page shows the choose subjects step, where add for me works. */
  inStep: boolean;
  observer: string;
  run: FillRun;
}

const NO_STATUSES: Readonly<Record<string, HelperStatus>> = {};

export function useHelperModel(): HelperModel {
  const route = useCompanionRoute();
  const view = useCompanionView();
  const run = useStore(fillStore, (state) => state.run);
  const step = useStore(hostStore, (state) => state.page?.observation.step);
  const last = useStore(helperStore, (state) => state.last);
  const cleared = useStore(helperStore, (state) => state.clearedStop);
  const pinned = useStore(helperStore, (state) => state.current);
  const { checklist, health } = view;
  const stale =
    route === 'preRegistration' &&
    (health.status === 'degraded' || health.status === 'off');
  const adding = run.status === 'running' ? run.subjectId : null;
  const stopped = run.status === 'stopped' && run !== cleared ? run : null;
  const stopSubject = stopped?.subjectId ?? null;
  const stopReason = stopped?.reason ?? null;
  // Only a stale page reads the last statuses, so a fresh reading never depends on them.
  const lastShown = stale ? last : NO_STATUSES;
  const { statuses, sent } = useMemo(
    () =>
      checklist === null
        ? { statuses: NO_STATUSES, sent: false }
        : deriveHelperStatuses({
            checklist,
            stale,
            last: lastShown,
            adding,
            stop:
              stopSubject === null || stopReason === null
                ? null
                : { subjectId: stopSubject, reason: stopReason },
          }),
    [checklist, stale, lastShown, adding, stopSubject, stopReason],
  );

  // The page's own statuses become the last known ones the moment it cannot be read.
  useEffect(() => {
    if (!stale && checklist !== null) recordLast(statuses);
  }, [stale, checklist, statuses]);

  const rows = checklist?.rows ?? [];
  const order = rows.map((row) => row.subjectId);
  // A subject being added stays in focus until it settles, unless the student pressed
  // another one.
  const currentId =
    pinned !== null && order.includes(pinned)
      ? pinned
      : adding !== null && order.includes(adding)
        ? adding
        : pickCurrent(order, statuses);

  // Once the subject in focus settles on the page, the focus moves on to the next one
  // that needs action. A subject the student presses after it settled stays in focus.
  const before = useRef(statuses);
  useEffect(() => {
    const was = currentId === null ? undefined : before.current[currentId];
    before.current = statuses;
    if (currentId === null || was === undefined || isDone(was)) return;
    const next = advanceCurrent(order, statuses, currentId);
    if (next !== currentId) setCurrent(next);
  });

  const termMismatch = checklist?.termMismatch ?? false;
  return {
    route,
    pick: view.pick,
    plan: view.plan,
    kit: view.kit,
    checklist,
    statuses,
    sent,
    stale,
    recheckable: canRecheck(health),
    offReason: health.status === 'off' ? health.reason : null,
    termMismatch,
    hasKit: checklist?.hasKit ?? false,
    attention: needsLook(statuses) || stale || termMismatch,
    done: sent ? rows.length : doneCount(statuses),
    total: rows.length,
    current: rows.find((row) => row.subjectId === currentId) ?? null,
    inStep: step === 2,
    observer: health.status,
    run,
  };
}
