// The prepare card of the registration helper, opened from the plan menu. It explains the
// prepare action, runs it on the student's press, and says when the kit was prepared. The
// helper card's count and list on the registration page read each subject from there, so
// this card keeps no review of its own. On a registration page the action is refused with
// a one line reason before anything is sent (ADR-0075). On the pre registration page the
// reason points to the helper's own prepare press, the one place prepare runs there
// (ADR-0076), named by the label the checklist shows, but only while the helper offers
// that press for the plan this card would prepare; otherwise it points to the course
// search page, as on every other registration page. The layer fills the plan menu's
// slot with the action that opens the card while it is mounted, so the plan menu
// imports nothing of the helper.

import { useEffect } from 'react';
import { useStore } from 'zustand';
import { LoaderCircle } from 'lucide-react';
import { ModalDialog } from '@/components/ModalDialog';
import { fillTemplate } from '@/lib/i18n/template';
import type { TranslationKey } from '@/lib/i18n/t';
import { FOCUS_OUTLINE, FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_HEIGHT } from '@/lib/ui/target';
import {
  canPrepareInHelper,
  helperBar,
  pageStale,
} from '@/lib/regis/helperBar';
import type { CompanionRoute } from '@/lib/regis/route';
import { formatLocalDateTime } from '@/features/planner/examText';
import { useSearchDeps } from '@/features/search/SearchDepsContext';
import { planMenuSlotStore } from '@/features/shell/planMenuSlotStore';
import { useQuietRoute } from '@/features/shell/quietRoute';
import { useTranslation } from '@/features/shell/useTranslation';
import { cancelPrepare, startPrepare } from './prepareController';
import { regisStore } from './regisStore';
import {
  useCompanionRoute,
  useCompanionView,
  type CompanionView,
} from './useCompanion';

const BUTTON = `inline-flex items-center justify-center gap-1.5 rounded-kcp px-3 py-1.5 text-sm font-semibold ${TARGET_HEIGHT}`;

function openReadiness(): void {
  regisStore.getState().setReadinessOpen(true);
}

export function ReadinessLayer() {
  const open = useStore(regisStore, (state) => state.readinessOpen);
  useEffect(() => {
    const slot = planMenuSlotStore.getState();
    slot.setPrepareRegistration(openReadiness);
    return () => {
      slot.setPrepareRegistration(null);
    };
  }, []);
  return open ? <ReadinessDialog /> : null;
}

/**
 * Whether the helper offers its prepare press for this plan now, as its kit bar decides,
 * and the label that press shows: Prepare again over data past the age limit.
 */
function helperOffers(
  route: CompanionRoute | null,
  helper: CompanionView,
  planId: string | null,
): TranslationKey | null {
  const { pick, checklist } = helper;
  // The helper shows no bar at all over an empty checklist.
  const bar =
    checklist === null || checklist.total === 0
      ? null
      : helperBar({
          stale: pageStale(route, helper.health),
          termMismatch: checklist.termMismatch,
          hasKit: checklist.hasKit,
        });
  const offered = canPrepareInHelper({
    route,
    confirmed: pick.kind === 'plan' && pick.confirmed,
    bar,
    samePlan: pick.kind === 'plan' && pick.plan.id === planId,
  });
  if (!offered) return null;
  return helper.staleKit === null
    ? 'regis.prepareInline'
    : 'regis.prepareAgain';
}

function ReadinessDialog() {
  const { t } = useTranslation();
  const { send } = useSearchDeps();
  const quiet = useQuietRoute();
  const route = useCompanionRoute();
  const helper = useCompanionView('helper');
  // The prepare card prepares the plan the planner shows, whatever page it opens over.
  const { plan, storedKit, kitState } = useCompanionView('active');
  const helperPress = helperOffers(route, helper, plan?.id ?? null);
  const run = useStore(regisStore, (state) => state.run);
  const close = () => {
    regisStore.getState().setReadinessOpen(false);
  };
  const running = run.status === 'running' && run.planId === plan?.id;
  const empty = plan === null || plan.entries.length === 0;

  const footer = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {quiet ? (
        <p className="mr-auto min-w-0 flex-1 text-xs text-warn">
          {helperPress === null
            ? t('regis.prepareRefused')
            : fillTemplate(t('regis.prepareInHelper'), {
                press: t(helperPress),
              })}
        </p>
      ) : null}
      {running ? (
        <button
          type="button"
          onClick={cancelPrepare}
          className={`${BUTTON} border border-border text-ink hover:bg-surface-alt ${FOCUS_RING}`}
        >
          {t('action.cancel')}
        </button>
      ) : null}
      <button
        type="button"
        disabled={quiet || running || empty}
        onClick={() => {
          if (plan !== null) startPrepare(plan, send, t);
        }}
        className={`${BUTTON} bg-primary-strong text-white hover:bg-primary-hover disabled:opacity-50 disabled:hover:bg-primary-strong ${FOCUS_OUTLINE}`}
      >
        {t(storedKit === null ? 'regis.prepare' : 'regis.prepareAgain')}
      </button>
    </div>
  );

  return (
    <ModalDialog
      title={t('regis.title')}
      closeLabel={t('action.close')}
      onClose={close}
      width="medium"
      footer={footer}
    >
      <div className="flex flex-col gap-3">
        <p>{t('regis.prepareIntro')}</p>
        {empty ? <p className="text-ink-soft">{t('regis.noPlan')}</p> : null}
        <div className="flex flex-col gap-1">
          {running ? (
            <p className="flex items-center gap-2">
              <LoaderCircle
                size={16}
                aria-hidden
                className="motion-safe:animate-spin"
              />
              {fillTemplate(t('regis.preparing'), {
                done: run.done,
                total: run.total,
              })}
            </p>
          ) : null}
          {run.status === 'cancelled' && run.planId === plan?.id ? (
            <p className="text-ink-soft">{t('regis.prepareCancelled')}</p>
          ) : null}
        </div>
        {storedKit !== null ? (
          <p className={kitState === 'stale' ? 'text-warn' : 'text-ink-soft'}>
            {kitState === 'stale'
              ? t('regis.kitStale')
              : fillTemplate(t('regis.preparedAt'), {
                  date: formatLocalDateTime(new Date(storedKit.preparedAt), t),
                })}
          </p>
        ) : null}
      </div>
    </ModalDialog>
  );
}
